// To do:
// [x] printable ASCII is covered, from its first character to its last; control characters are not
// [x] what only the arrows' file covers counts (the pen falls back to it): → ←; and ≤ ≥ ≈, which only the pen has
// [x] what no font covers does not: emoji, CJK, Greek
// [x] superscript digits, for powers such as 0.99¹⁰⁰: ¹ ² ³ are Latin-1, ⁰ and ⁴–⁹ were added to the pen's subset
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

  test("counts what only the arrows' file covers, and what only the pen has, since the stack falls back", () => {
    expect(covered("→←≤≥≈")).toHaveLength(5);
  });

  test("covers every superscript digit, for powers such as 0.99¹⁰⁰", () => {
    expect(covered("⁰¹²³⁴⁵⁶⁷⁸⁹")).toHaveLength(10);
  });

  test("does not cover what no font has", () => {
    expect(covered("😀漢αλ")).toEqual([]);
  });
});
