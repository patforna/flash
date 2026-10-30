// To do:
// [x] printable ASCII is covered, from its first character to its last; control characters are not
// [ ] what only Radon covers counts (the font stack falls back to it): → ← ≤ ≥ ≈
// [ ] what neither font covers does not: emoji, CJK, Greek beyond Ω
import { describe, expect, test } from "bun:test";
import { isCovered } from "./glyphs";

const covered = (text: string) => [...text].filter((ch) => isCovered(ch.codePointAt(0) ?? 0));

describe("isCovered", () => {
  test("covers printable ASCII from its first character to its last, and no control characters", () => {
    expect(isCovered(0x20)).toBe(true);
    expect(isCovered(0x7e)).toBe(true);
    expect(covered("Az09 ?!`*_-")).toHaveLength(11);
    expect(covered("\t\n\r\u001f\u007f")).toEqual([]);
  });
});
