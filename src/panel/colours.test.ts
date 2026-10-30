// To do:
// [x] index 0 is the first sticker colour
// [x] cycles the eight in token order
import { describe, expect, it } from "vitest";
import { colourFor } from "./colours";

describe("colourFor", () => {
  it("gives the first sticker colour for index 0", () => {
    expect(colourFor(0)).toBe("var(--s-pink)");
  });

  it("cycles the eight sticker colours in token order", () => {
    const tokens = ["pink", "marigold", "mint", "sky", "lilac", "tangerine", "teal", "lime"];
    expect(Array.from({ length: 10 }, (_, i) => colourFor(i))).toEqual(
      [...tokens, "pink", "marigold"].map((name) => `var(--s-${name})`),
    );
  });
});
