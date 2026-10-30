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

type Rendered = { html: string } | { problems: string[] };

export function renderAnswer(src: string): Rendered {
  // A hard break comes out as `<br />` plus the line's own newline: one break, like a soft one.
  const html = Bun.markdown.html(src, OPTIONS).replaceAll("<br />\n", "\n");
  return { html: html.trim().replaceAll("\n", "<br>") };
}
