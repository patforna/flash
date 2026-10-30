import { parse } from "smol-toml";
import type { z } from "zod";
import { type CardsFile, CardsFileSchema, LIMITS } from "../shared/schema";
import type { Card, Deck } from "../shared/types";
import { renderAnswer, renderQuestion } from "./markdown";

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
  const data = parse(toml);
  const issues = CardsFileSchema.safeParse(data, { reportInput: true }).error?.issues ?? [];
  // An unknown key stops no check; a missing or mistyped field skips the checks of the card or list that holds it.
  const intact = (...path: PropertyKey[]) =>
    !issues.some((issue) => issue.code !== "unrecognized_keys" && path.every((key, n) => issue.path[n] === key));
  const file = data as CardsFile;
  const cards = Array.isArray(file.card) ? file.card : [];

  const problems: [card: number, text: string][] = [];
  const report = (card: number, text: string) => {
    const question = cards[card]?.question;
    const label = typeof question === "string" ? `card ${card + 1} "${slug(question.trim())}"` : `card ${card + 1}`;
    problems.push([card, `${label}: ${text}`]);
  };

  for (const issue of issues) {
    const [, card] = issue.path;
    if (typeof card === "number") for (const text of describe(issue)) report(card, text);
  }

  const seen = new Map<string, number>();
  const rendered: Card[] = [];
  cards.forEach((card, i) => {
    if (!intact("card", i)) return;
    const question = card.question.trim();
    if (question.length > LIMITS.questionMax) {
      report(i, `question is ${question.length} characters (max ${LIMITS.questionMax})`);
    }
    const first = seen.get(question.toLowerCase());
    if (first === undefined) seen.set(question.toLowerCase(), i);
    else report(i, `question duplicates card ${first + 1}`);
    if (intact("topics")) {
      for (const topic of card.topics) if (!file.topics.includes(topic)) report(i, `topic "${topic}" is not declared`);
    }
    const questionHtml = renderQuestion(question);
    const answerHtml = renderAnswer(card.answer.trim());
    rendered.push({
      id: slug(question),
      topics: card.topics,
      questionHtml: "html" in questionHtml ? questionHtml.html : "",
      answerHtml: "html" in answerHtml ? answerHtml.html : "",
    });
  });

  // Grouped by card, in file order (the sort is stable).
  if (problems.length > 0) throw new DeckError(problems.sort(([a], [b]) => a - b).map(([, text]) => text));
  const content = { topics: file.topics, cards: rendered };
  return { version: version(content), ...content };
}

function describe(issue: z.core.$ZodIssue): string[] {
  return issue.code === "unrecognized_keys" ? issue.keys.map((key) => `unknown key "${key}"`) : [issue.message];
}

// The ETag and what /healthz reports: the first 12 characters of the base64url SHA-256 of the deck's JSON.
function version(content: Omit<Deck, "version">): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(content)).digest("base64url").slice(0, 12);
}
