// To do:
// [ ] slug: lowercase ASCII words joined by "-"; accents dropped; at most 64 characters, never ending in "-"
// [ ] loadDeck turns a minimal deck into its declared topics and cards, ids slugged from the questions
// [ ] the version: 12 base64url characters, stable for the same deck, different when a card changes
// [ ] loadDeck reports every problem at once, naming the card: undeclared topic, duplicate question, long question, unknown key
// [ ] a TOML syntax error is one problem with its line and column
// [ ] shape: unknown top-level key, missing field, wrong type; a misspelt key doesn't stop the other cards' checks
// [ ] declared topics: 1–30, 1–20 characters, the pattern, no trailing space, no repeats, each used
// [ ] cards: 1–500
// [ ] a card's topics: 1–3, declared, no repeats
// [ ] question: 8–100 characters after trimming, one line, inline markup only, unique ignoring case
// [ ] answer: 1–520 characters after trimming, at most 12 lines, code lines at most 46 characters, no tabs, markup
// [ ] characters the fonts don't cover fail, named with their code point
// [ ] ids unique: different questions with the same slug
// [ ] the fixture deck loads cleanly
import { describe, expect, test } from "bun:test";
import { slug } from "./deck";

describe("slug", () => {
  test("joins the lowercase words of a question with dashes", () => {
    expect(slug("What does Redis do by default when memory is full?")).toBe(
      "what-does-redis-do-by-default-when-memory-is-full",
    );
  });
});
