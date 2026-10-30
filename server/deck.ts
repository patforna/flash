import { parse, TomlError } from "smol-toml";
import type { z } from "zod";
import { isCovered } from "../shared/glyphs";
import { type CardsFile, CardsFileSchema, LIMITS } from "../shared/schema";
import type { Card, Deck } from "../shared/types";
import { FENCE, type Rendered, renderAnswer, renderQuestion } from "./markdown";

export class DeckError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(problems.join("\n"));
    this.name = "DeckError";
    this.problems = problems;
  }
}

export function slug(text: string): string {
  return text
    .normalize("NFKD") // "é" → "e" and a combining accent, which goes
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, LIMITS.id)
    .replace(/-$/, "");
}

// Parses, validates and renders the deck, or throws a DeckError listing every problem.
export function loadDeck(toml: string): Deck {
  const data = parseToml(toml);
  const issues = CardsFileSchema.safeParse(data, { reportInput: true }).error?.issues ?? [];
  // An unknown key stops no check; a missing or mistyped field skips the checks of the card or list that holds it.
  const intact = (...path: PropertyKey[]) =>
    !issues.some((issue) => issue.code !== "unrecognized_keys" && path.every((key, n) => issue.path[n] === key));
  const file = data as CardsFile;
  const cards = Array.isArray(file.card) ? file.card : [];

  // A problem with a card names it; one with the file comes first.
  const problems: [card: number, text: string][] = [];
  const label = (card: number) => {
    const question = cards[card]?.question;
    const id = typeof question === "string" ? slug(question.trim()) : "";
    return id ? `card ${card + 1} "${id}"` : `card ${card + 1}`;
  };
  const report = (card: number | undefined, text: string) => {
    problems.push(card === undefined ? [-1, text] : [card, `${label(card)}: ${text}`]);
  };

  for (const issue of issues) {
    const [key, card, ...field] = issue.path;
    if (key === "card" && typeof card === "number") for (const text of explain(issue, field)) report(card, text);
    else for (const text of explain(issue, issue.path)) report(undefined, text);
  }

  if (intact("topics")) for (const text of checkDeclaredTopics(file.topics)) report(undefined, text);
  if (Array.isArray(file.card) && cards.length === 0) report(undefined, "no cards");
  if (cards.length > LIMITS.cards) report(undefined, `${cards.length} cards (max ${LIMITS.cards})`);

  // Questions equal but for case share an id, so one map finds both kinds of duplicate.
  const ids = new Map<string, number>();
  const rendered: Card[] = [];
  cards.forEach((raw, i) => {
    if (!intact("card", i)) return;
    const { card, problems } = readCard(raw, intact("topics") ? file.topics : undefined);
    for (const text of problems) report(i, text);
    const first = ids.get(card.id);
    if (first === undefined) ids.set(card.id, i);
    // A question with nothing to make an id from has no id to clash on, and says so itself.
    else if (card.id) {
      const same = cards[first]?.question.trim().toLowerCase() === raw.question.trim().toLowerCase();
      report(i, `${same ? "question" : "id"} duplicates card ${first + 1}`);
    }
    rendered.push(card);
  });

  // Whether a topic is used can only be judged when every card is intact.
  if (intact("topics") && intact("card")) {
    const used = new Set(rendered.flatMap((card) => card.topics));
    for (const topic of file.topics)
      if (!used.has(topic)) report(undefined, `topic "${topic}" is not used by any card`);
  }

  // Grouped by card, in file order (the sort is stable).
  if (problems.length > 0) throw new DeckError(problems.sort(([a], [b]) => a - b).map(([, text]) => text));
  const content = { topics: file.topics, cards: rendered };
  return { version: version(content), ...content };
}

// One card's own rules, and the card as rendered. `declared` is undefined when the declared topics are broken.
function readCard(raw: CardsFile["card"][number], declared: readonly string[] | undefined) {
  const question = readQuestion(raw.question.trim());
  const answer = readAnswer(raw.answer.trim());
  const card: Card = {
    id: slug(raw.question.trim()),
    topics: raw.topics,
    questionHtml: question.html,
    answerHtml: answer.html,
  };
  return { card, problems: [...question.problems, ...checkCardTopics(raw.topics, declared), ...answer.problems] };
}

function readQuestion(question: string) {
  const problems: string[] = [];
  if (question.length < LIMITS.questionMin) {
    problems.push(`question is ${question.length} characters (min ${LIMITS.questionMin})`);
  } else if (slug(question) === "") problems.push("question has no letters or digits to make its id from");
  if (question.length > LIMITS.questionMax) {
    problems.push(`question is ${question.length} characters (max ${LIMITS.questionMax})`);
  }
  if (question.includes("\t")) problems.push("question has a tab");
  return finish("question", question, renderQuestion(question), problems);
}

function readAnswer(answer: string) {
  const problems: string[] = [];
  if (answer === "") problems.push("answer is empty");
  if (answer.length > LIMITS.answerMax)
    problems.push(`answer is ${answer.length} characters (max ${LIMITS.answerMax})`);
  const lines = answer.split("\n");
  if (lines.length > LIMITS.answerLines) problems.push(`answer is ${lines.length} lines (max ${LIMITS.answerLines})`);
  let fenced = false;
  lines.forEach((line, n) => {
    if (line.includes("\t")) problems.push(`answer has a tab on line ${n + 1}`);
    if (FENCE.test(line)) fenced = !fenced;
    else if (fenced && line.length > LIMITS.codeLine) {
      problems.push(`code on answer line ${n + 1} is ${line.length} characters (max ${LIMITS.codeLine})`);
    }
  });
  return finish("answer", answer, renderAnswer(answer), problems);
}

// Adds what the markup and the characters break to a field's problems, and keeps its HTML.
function finish(field: string, text: string, result: Rendered, problems: string[]) {
  if ("problems" in result) problems.push(...result.problems.map((reason) => `${field} has ${reason}`));
  const html = "html" in result ? result.html : "";
  // The HTML too: an entity such as `&#x2713;` only becomes its character there.
  for (const character of uncovered(text + html)) problems.push(`${field} has ${character}, which neither font covers`);
  return { html, problems };
}

function checkCardTopics(topics: string[], declared: readonly string[] | undefined): string[] {
  const problems: string[] = [];
  if (topics.length === 0) problems.push("has no topics");
  if (topics.length > LIMITS.cardTopics) problems.push(`has ${topics.length} topics (max ${LIMITS.cardTopics})`);
  for (const topic of topics) {
    if (declared && !declared.includes(topic)) problems.push(`topic "${topic}" is not declared`);
  }
  for (const topic of repeated(topics)) problems.push(`topic "${topic}" is listed more than once`);
  return problems;
}

// Each character neither font covers, once, with its code point: `"😀" (U+1F600)`. Line breaks and tabs have rules of
// their own; the word joiner the renderer puts after a hyphen (U+2060) is never drawn.
const UNDRAWN = new Set(["\n", "\t", "\u2060"]);
function uncovered(text: string): string[] {
  const missing = new Set([...text].filter((c) => !UNDRAWN.has(c) && !isCovered(c.codePointAt(0) ?? 0)));
  return [...missing].map((c) => `"${c}" (U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")})`);
}

const LABEL = /^[A-Za-z0-9][A-Za-z0-9 &+./-]*$/;

function checkDeclaredTopics(topics: string[]): string[] {
  const problems: string[] = [];
  if (topics.length === 0) problems.push("no topics declared");
  if (topics.length > LIMITS.topics) problems.push(`${topics.length} topics declared (max ${LIMITS.topics})`);
  for (const topic of topics) {
    const name = `topic "${topic}"`;
    if (topic === "") problems.push(`${name} is empty`);
    else if (topic.length > LIMITS.topicLabel) {
      problems.push(`${name} is ${topic.length} characters (max ${LIMITS.topicLabel})`);
    } else if (topic.endsWith(" ")) problems.push(`${name} ends with a space`);
    else if (!LABEL.test(topic)) {
      problems.push(`${name} must start with a letter or digit and hold only letters, digits, spaces and & + . / -`);
    }
  }
  for (const topic of repeated(topics)) problems.push(`topic "${topic}" is declared more than once`);
  return problems;
}

// What appears more than once, each once.
function repeated(items: string[]): string[] {
  return [...new Set(items.filter((item, i) => items.indexOf(item) !== i))];
}

function parseToml(toml: string) {
  try {
    return parse(toml);
  } catch (error) {
    if (!(error instanceof TomlError)) throw error;
    // The message's first line, after smol-toml's prefix; the rest repeats the source around the error.
    const reason = error.message.split("\n", 1)[0]?.replace("Invalid TOML document: ", "");
    throw new DeckError([`line ${error.line}, column ${error.column}: ${reason}`]);
  }
}

function explain(issue: z.core.$ZodIssue, path: PropertyKey[]): string[] {
  if (issue.code === "unrecognized_keys") return issue.keys.map((key) => `unknown key "${key}"`);
  const field = path.map((key) => (typeof key === "number" ? `item ${key + 1}` : String(key))).join(" ");
  if (issue.code !== "invalid_type") return [`${field}: ${issue.message}`];
  if (issue.input === undefined) return [`${field} is missing`];
  return [`${field} must be ${/^[aeiou]/.test(issue.expected) ? "an" : "a"} ${issue.expected}`];
}

// The ETag and what /healthz reports: the first 12 characters of the base64url SHA-256 of the deck's JSON.
function version(content: Omit<Deck, "version">): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(content)).digest("base64url").slice(0, 12);
}
