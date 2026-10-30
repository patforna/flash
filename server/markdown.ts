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
  return { html: Bun.markdown.html(src, OPTIONS).trim().replaceAll("\n", "<br>") };
}
