// To do:
// [x] renderAnswer: a line renders as a paragraph
// [x] each source line of a paragraph is a line on the card: soft breaks become <br>
// [x] a hard break (two trailing spaces or a backslash) is one <br>, not two
// [x] `-` and `1.` lists render tight, `start` kept on `ol`; a lead-in line stays a paragraph; items keep their breaks
// [x] fenced code renders as pre > code without its class, its lines and escapes intact
// [x] inline code and bold render; -> and <- are typeset as → and ← outside code
// [x] raw HTML is escaped text, not an error; tables, strikethrough, task lists and autolinks stay text
// [x] rejects a heading (ATX and setext), a link, an image, a block quote, a rule and emphasis, each with its reason
// [x] rejects a loose list, a list inside a list and a code block inside a list item
// [ ] rejects an unclosed fence, caught on the source
// [ ] reports every reason at once, each once
// [ ] renderQuestion: plain text without the outer <p>; inline code, bold and arrows
// [ ] renderQuestion rejects a second line, block markup and emphasis
import { describe, expect, test } from "bun:test";
import { renderAnswer } from "./markdown";

describe("renderAnswer", () => {
  test("renders a line as a paragraph", () => {
    expect(renderAnswer("One line.")).toEqual({ html: "<p>One line.</p>" });
  });

  test("makes each source line of a paragraph a line on the card", () => {
    expect(renderAnswer("First line\nsecond line")).toEqual({ html: "<p>First line<br>second line</p>" });
  });

  test("makes a hard break one line break, not two", () => {
    expect(renderAnswer("Two spaces  \nor a backslash\\\nend a line")).toEqual({
      html: "<p>Two spaces<br>or a backslash<br>end a line</p>",
    });
  });

  test("renders tight lists after a lead-in line, keeping the start of a numbered list and the items' breaks", () => {
    expect(renderAnswer("Lead in:\n- one\n- two\n\n3. three\nstill three\n4. four")).toEqual({
      html: '<p>Lead in:</p><ul><li>one</li><li>two</li></ul><ol start="3"><li>three<br>still three</li><li>four</li></ol>',
    });
  });

  test("renders fenced code without its class, its lines and escapes intact", () => {
    expect(renderAnswer("Run:\n```sql\nSELECT 1\n  WHERE a <> b;\n```")).toEqual({
      html: "<p>Run:</p><pre><code>SELECT 1\n  WHERE a &lt;&gt; b;\n</code></pre>",
    });
  });

  test("renders inline code and bold, and typesets -> and <- as arrows outside code", () => {
    expect(renderAnswer("A -> B, `a -> b`, **x <- y**\n- c -> d\n```\ne <- f\n```")).toEqual({
      html: "<p>A → B, <code>a -&gt; b</code>, <strong>x ← y</strong></p><ul><li>c → d</li></ul><pre><code>e &lt;- f\n</code></pre>",
    });
  });

  test("leaves raw HTML, tables, strikethrough, task lists, bare links and indented code as text", () => {
    const src = "<b>raw</b>\n\n<div>\nblock\n</div>\n\n    indented\n\n| a | b |\n|---|---|\n\n~~gone~~ https://x.dev\n\n- [ ] task";

    expect(renderAnswer(src)).toEqual({
      html:
        "<p>&lt;b&gt;raw&lt;/b&gt;</p><p>&lt;div&gt;<br>block<br>&lt;/div&gt;</p><p>indented</p>" +
        "<p>| a | b |<br>|---|---|</p><p>~~gone~~ https://x.dev</p><ul><li>[ ] task</li></ul>",
    });
  });

  test.each(["# Title", "Title\n---", "Title\n==="])("rejects a heading with its reason: %p", (src) => {
    expect(renderAnswer(src)).toEqual({
      problems: ["a heading (a line starting with #, or a line underlined with --- or ===)"],
    });
  });

  test.each([
    ["[docs](https://x.dev)", "a link"],
    ["![logo](x.png)", "an image"],
    ["> quoted", "a block quote (a line starting with >)"],
    ["Above\n\n---\n\nBelow", "a horizontal rule (a line of ---, *** or ___)"],
    ["*maybe* or _maybe_", "emphasis (*text* or _text_): only **bold** is allowed"],
  ])("rejects %p with its reason", (src, reason) => {
    expect(renderAnswer(src)).toEqual({ problems: [reason] });
  });

  test.each([
    ["- one\n\n- two", "a loose list (blank lines between its items)"],
    ["- one\n  - inner", "a list inside a list"],
    ["1. one\n   ```\n   code\n   ```", "a code block inside a list item"],
  ])("rejects %p: a list item holds one or more lines of text only", (src, reason) => {
    expect(renderAnswer(src)).toEqual({ problems: [reason] });
  });
});
