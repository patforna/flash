// Bun.markdown is unstable: the tests pin what it emits.
const OPTIONS = {
  noHtmlBlocks: true,
  noHtmlSpans: true,
  noIndentedCodeBlocks: true,
  tables: false,
  tasklists: false,
  strikethrough: false,
  autolinks: false,
};

// A line that opens a fenced code block: 3 or more backticks (a backtick fence's info string has none) or tildes.
const FENCE = /^ *(`{3,}(?=[^`]*$)|~{3,})/;

// A line Markdown reads as a link reference definition and hides: `[label]: …`, also opening a list item.
const REFERENCE = /^ *(?:(?:[-+*]|\d{1,9}[.)]) +)?\[[^\]]+\]:/;

export type LineKind = "text" | "fence" | "code";

// Each source line's kind as Bun (md4c) reads it with indented code off, where indentation never matters: a fence
// opens on a FENCE line and closes only on a line of the same character, at least as long, with nothing after it but
// spaces. `unclosed`: a fence still open at the end, which Bun closes silently.
export function readLines(src: string): { kinds: LineKind[]; unclosed: boolean } {
  const kinds: LineKind[] = [];
  let fence: string | undefined;
  for (const line of src.split("\n")) {
    if (fence === undefined) {
      fence = FENCE.exec(line)?.[1];
      kinds.push(fence ? "fence" : "text");
    } else if (new RegExp(`^ *${fence[0]}{${fence.length},} *$`).test(line)) {
      fence = undefined;
      kinds.push("fence");
    } else kinds.push("code");
  }
  return { kinds, unclosed: fence !== undefined };
}

// U+2060 WORD JOINER: invisible, it forbids a line break on either side of it.
const JOIN = "\u2060";

// U+00A0 NO-BREAK SPACE: a space no line breaks at. Both fonts draw it.
const HOLD = "\u00a0";

// Bun escapes `<` in text and attribute values, so every `<` in its output starts a tag.
const TOKEN = /<(\/?)([a-z][a-z0-9]*)([^>]*)>|([^<]+)/g;

const ANSWER_TAGS = new Set(["p", "br", "ul", "ol", "li", "strong", "code", "pre"]);
const QUESTION_TAGS = new Set(["p", "strong", "code"]);

const HEADING = "a heading (a line starting with #, or a line underlined with --- or ===)";
const REASONS: Record<string, string> = {
  h1: HEADING,
  h2: HEADING,
  h3: HEADING,
  h4: HEADING,
  h5: HEADING,
  h6: HEADING,
  a: "a link",
  img: "an image",
  blockquote: "a block quote (a line starting with >)",
  hr: "a horizontal rule (a line of ---, *** or ___)",
  em: "emphasis (*text* or _text_): only **bold** is allowed",
  ul: "a list",
  ol: "a list",
  li: "a list",
  pre: "a code block",
};

// A list item holds lines of text only.
const IN_ITEM: Record<string, string> = {
  p: "a loose list (blank lines between its items)",
  ul: "a list inside a list",
  ol: "a list inside a list",
  pre: "a code block inside a list item",
};

export type Rendered = { html: string } | { problems: string[] };

export function renderAnswer(src: string): Rendered {
  return result(render(src, ANSWER_TAGS));
}

export function renderQuestion(src: string): Rendered {
  const { html, problems } = render(src, QUESTION_TAGS);
  if (src.includes("\n")) problems.add("more than one line");
  return result({ html: html.replace(/^<p>(.*)<\/p>$/, "$1"), problems });
}

function result({ html, problems }: { html: string; problems: Set<string> }): Rendered {
  return problems.size > 0 ? { problems: [...problems] } : { html };
}

function render(src: string, allowed: ReadonlySet<string>) {
  const problems = new Set<string>();
  const { kinds, unclosed } = readLines(src);
  if (unclosed) problems.add("an unclosed code fence (``` or ~~~)");
  src.split("\n").forEach((line, n) => {
    if (kinds[n] === "text" && REFERENCE.test(line)) {
      problems.add("a link reference definition ([label]: …), which Markdown hides");
    }
  });
  const open: string[] = [];
  // A hard break comes out as `<br />` plus the line's own newline: one break, like a soft one.
  const html = Bun.markdown
    .html(src, OPTIONS)
    .replaceAll("<br />\n", "\n")
    .replace(TOKEN, (_: string, slash: string, name: string, attrs: string, text: string | undefined) => {
      if (text !== undefined) {
        // Code keeps its lines; in a paragraph or an item each line is a card line; whitespace between blocks goes.
        if (open.includes("pre")) return text;
        if (!open.some((t) => t === "p" || t === "li")) return "";
        const lines = text.replaceAll("\n", "<br>");
        // A hyphen in a word, or any in code, holds on to what follows it, so no line breaks inside a compound or an
        // identifier (neither font has a non-breaking hyphen).
        if (open.includes("code")) return holdCode(lines).replaceAll("-", `-${JOIN}`);
        // The arrows arrive escaped: <->, -> and <-, however many dashes.
        return (
          lines
            .replace(/&lt;-+&gt;/g, "↔")
            .replace(/-+&gt;/g, "→")
            .replace(/&lt;-+/g, "←")
            // An arrow holds on to what it points at: a line may break before it, never after it.
            .replace(/([→←↔]) /g, `$1${HOLD}`)
            .replace(/([\p{L}\p{N}])-(?=[\p{L}\p{N}])/gu, `$1-${JOIN}`)
            // A range never breaks at its dash (2–4, a–z), and a number holds on to the word it counts (7 days, 1 s,
            // 100k writes), unless it is part of a word or a version (s3, v1.2).
            .replace(/([\p{L}\p{N}])–(?=[\p{L}\p{N}])/gu, `$1–${JOIN}`)
            .replace(/(?<![\p{L}\p{N}_.,])(\d+(?:[.,]\d+)*[kM%+]?) (?=\p{L})/gu, `$1${HOLD}`)
            // Apostrophes and single quotes as a hand writes them: after a letter or digit an apostrophe or a closing
            // quote (don’t, clients’), any other an opening quote. Shantell draws ' as an upright tick.
            .replace(/(?<=[\p{L}\p{N}])'/gu, "’")
            .replace(/'/g, "‘")
        );
      }
      if (slash) {
        open.pop();
        return `</${name}>`;
      }
      if (!allowed.has(name)) problems.add(REASONS[name] ?? `<${name}>`);
      const inItem = open.at(-1) === "li" ? IN_ITEM[name] : undefined;
      if (inItem) problems.add(inItem);
      open.push(name);
      // Every attribute goes but the start of a numbered list (`code` loses its `class="language-…"`).
      return `<${name}${name === "ol" ? (attrs.match(/ start="\d+"/)?.[0] ?? "") : ""}>`;
    });
  return { html, problems };
}

// Inline code holds together where a break would split what reads as one: a span of up to 20 characters, a word of
// one or two at either end of a longer one (`ON CONFLICT …`), and a quoted value of up to 18 (`= 'ANY 1 (s1, s2)'`).
function holdCode(html: string): string {
  if (shown(html) <= 20) return html.replaceAll(" ", HOLD);
  const short = (word: string) => shown(word) <= 2;
  return html
    .replace(/^(\S+) /, (all, word: string) => (short(word) ? `${word}${HOLD}` : all))
    .replace(/ (\S+)$/, (all, word: string) => (short(word) ? `${HOLD}${word}` : all))
    .replace(/('|&quot;)(.*?)\1/g, (quoted, _, value: string) =>
      shown(value) <= 18 ? quoted.replaceAll(" ", HOLD) : quoted,
    );
}

// How many characters HTML text shows: an entity (`&gt;`, `&quot;`) is one.
const shown = (html: string) => html.replace(/&(?:#\w+|\w+);/g, "x").length;
