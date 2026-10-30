// To do:
// [x] renderAnswer: a line renders as a paragraph
// [x] each source line of a paragraph is a line on the card: soft breaks become <br>
// [x] a hard break (two trailing spaces or a backslash) is one <br>, not two
// [x] `-` and `1.` lists render tight, `start` kept on `ol`; a lead-in line stays a paragraph; items keep their breaks
// [ ] fenced code renders as pre > code without its class, its lines and escapes intact
// [ ] inline code and bold render; -> and <- are typeset as → and ← outside code
// [ ] raw HTML is escaped text, not an error; tables, strikethrough, task lists and autolinks stay text
// [ ] rejects a heading (ATX and setext), a link, an image, a block quote, a rule and emphasis, each with its reason
// [ ] rejects a loose list, a list inside a list and a code block inside a list item
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
});
