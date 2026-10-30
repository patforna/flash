// Conventions checked on the sources by regex: TypeScript 7's package exports no compiler API to parse them with.
import { describe, expect, test } from "vitest";

const sources = import.meta.glob<string>("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });

// An effect whose body is an expression, `useEffect(() => el.scrollTo(…))`: its value is returned as the cleanup, and
// a Promise there (scrollTo returns one in current Chrome) blanks the app when React calls it.
const EXPRESSION_BODIED_EFFECT = /\buse(?:Layout)?Effect\(\s*\([^)]*\)\s*=>(?!\s*\{)/;

describe("conventions", () => {
  test("reads the sources", () => {
    expect(Object.keys(sources)).toContain("/src/app/App.tsx");
  });

  test("every effect has a braced body", () => {
    const offenders = Object.entries(sources)
      .filter(([, source]) => EXPRESSION_BODIED_EFFECT.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
