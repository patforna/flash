// To do:
// [x] renderAnswer: a line renders as a paragraph
// [ ] each source line of a paragraph is a line on the card: soft breaks become <br>
// [ ] a hard break (two trailing spaces or a backslash) is one <br>, not two
// [ ] `-` and `1.` lists render tight, `start` kept on `ol`; a lead-in line stays a paragraph; items keep their breaks
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
});
