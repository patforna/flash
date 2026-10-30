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
const TOKEN = /<(\/?)([a-z][a-z0-9]*)[^>]*>|([^<]+)/g;

type Rendered = { html: string } | { problems: string[] };

export function renderAnswer(src: string): Rendered {
  const open: string[] = [];
  // A hard break comes out as `<br />` plus the line's own newline: one break, like a soft one.
  const html = Bun.markdown
    .html(src, OPTIONS)
    .replaceAll("<br />\n", "\n")
    .replace(TOKEN, (tag: string, slash: string, name: string | undefined, text: string | undefined) => {
      if (name === undefined) {
        // Whitespace between blocks is dropped; in a paragraph or an item, each line is a line on the card.
        return open.some((t) => t === "p" || t === "li") ? (text ?? "").replaceAll("\n", "<br>") : "";
      }
      if (slash) open.pop();
      else open.push(name);
      return tag;
    });
  return { html };
}
