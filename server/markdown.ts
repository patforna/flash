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

// Bun escapes `<` in text and attribute values, so every `<` in its output starts a tag.
const TOKEN = /<(\/?)([a-z][a-z0-9]*)([^>]*)>|([^<]+)/g;

const ANSWER_TAGS = new Set(["p", "br", "ul", "ol", "li", "strong", "code", "pre"]);

function reason(tag: string): string {
  return /^h[1-6]$/.test(tag) ? "a heading (a line starting with #, or a line underlined with --- or ===)" : `<${tag}>`;
}

type Rendered = { html: string } | { problems: string[] };

export function renderAnswer(src: string): Rendered {
  const problems = new Set<string>();
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
      if (!ANSWER_TAGS.has(name)) problems.add(reason(name));
      open.push(name);
      // Every attribute goes but the start of a numbered list (`code` loses its `class="language-…"`).
      return `<${name}${name === "ol" ? (attrs.match(/ start="\d+"/)?.[0] ?? "") : ""}>`;
    });
  return problems.size > 0 ? { problems: [...problems] } : { html };
}
