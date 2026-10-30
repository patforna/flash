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

// A line that opens or closes a fenced code block (a backtick fence's info string has no backticks).
const FENCE = /^ {0,3}(?:`{3,}[^`]*|~{3,}.*)$/;

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
};

// A list item holds lines of text only.
const IN_ITEM: Record<string, string> = {
  p: "a loose list (blank lines between its items)",
  ul: "a list inside a list",
  ol: "a list inside a list",
  pre: "a code block inside a list item",
};

type Rendered = { html: string } | { problems: string[] };

export function renderAnswer(src: string): Rendered {
  return result(render(src, ANSWER_TAGS));
}

export function renderQuestion(src: string): Rendered {
  const { html, problems } = render(src, QUESTION_TAGS);
  return result({ html: html.replace(/^<p>(.*)<\/p>$/, "$1"), problems });
}

function result({ html, problems }: { html: string; problems: Set<string> }): Rendered {
  return problems.size > 0 ? { problems: [...problems] } : { html };
}

function render(src: string, allowed: ReadonlySet<string>) {
  const problems = new Set<string>();
  // Bun silently closes an open fence at the end; an odd number of fence lines means one was never closed.
  if (src.split("\n").filter((line) => FENCE.test(line)).length % 2 === 1) {
    problems.add("an unclosed code fence (``` or ~~~)");
  }
  const open: string[] = [];
  // A hard break comes out as `<br />` plus the line's own newline: one break, like a soft one.
  const html = Bun.markdown
    .html(src, OPTIONS)
    .replaceAll("<br />\n", "\n")
    .replace(TOKEN, (_: string, slash: string, name: string, attrs: string, text: string | undefined) => {
      if (text !== undefined) {
        // Code keeps its lines; in a paragraph or an item each line is a line on the card; whitespace between blocks goes.
        if (open.includes("pre")) return text;
        if (!open.some((t) => t === "p" || t === "li")) return "";
        const lines = text.replaceAll("\n", "<br>");
        // The arrows arrive escaped.
        return open.includes("code") ? lines : lines.replaceAll("-&gt;", "→").replaceAll("&lt;-", "←");
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
