// To do:
// [x] printable ASCII is covered, from its first character to its last; control characters are not
// [x] what only Radon covers counts (the font stack falls back to it): → ← ≤ ≥ ≈
// [x] what neither font covers does not: emoji, CJK, Greek beyond Ω
// Run by `bun test`, which serves vitest's API: shared/ is in the browser program too, which has no `bun:test`.
import { describe, expect, test } from "vitest";
import { isCovered } from "./glyphs";

const covered = (text: string) => [...text].filter((ch) => isCovered(ch.codePointAt(0) ?? 0));

describe("isCovered", () => {
  test("covers printable ASCII from its first character to its last, and no control characters", () => {
    expect(isCovered(0x20)).toBe(true);
    expect(isCovered(0x7e)).toBe(true);
    expect(covered("Az09 ?!`*_-")).toHaveLength(11);
    expect(covered("\t\n\r\u001f\u007f")).toEqual([]);
  });

  test("counts what only Radon covers, since the font stack falls back to it", () => {
    expect(covered("→←≤≥≈")).toHaveLength(5);
  });

  test("does not cover what neither font has", () => {
    expect(covered("😀漢αλ")).toEqual([]);
  });
});
