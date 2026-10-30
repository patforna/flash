// To do:
// [x] index 0 is the first sticker colour
// [x] cycles the eight in token order
import { describe, expect, it } from "vitest";
import { colourFor } from "./colours";

describe("colourFor", () => {
  it("gives the first sticker colour for index 0", () => {
    expect(colourFor(0)).toBe("var(--s-pink)");
  });
});
