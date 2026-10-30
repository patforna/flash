// To do:
// [x] CardsFileSchema accepts topics and cards
// [x] it rejects an unknown key at the top level and on a card (catches `topic =`)
// [x] DeckSchema accepts the wire shape and rejects anything else
// Run by `bun test`, which serves vitest's API: shared/ is in the browser program too, which has no `bun:test`.
import { describe, expect, test } from "vitest";
import { CardsFileSchema, DeckSchema } from "./schema";

const card = { question: "What is Redis?", topics: ["Redis"], answer: "A key-value store." };

describe("CardsFileSchema", () => {
  test("accepts topics and cards", () => {
    const file = { topics: ["Redis"], card: [card] };

    expect(CardsFileSchema.parse(file)).toEqual(file);
  });

  test("rejects an unknown key at the top level and on a card", () => {
    const file = { version: 1, topics: ["Redis"], card: [{ ...card, topic: "Redis" }] };

    const issues = CardsFileSchema.safeParse(file).error?.issues ?? [];

    expect(issues.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: "unrecognized_keys", path: ["card", 0] },
      { code: "unrecognized_keys", path: [] },
    ]);
  });
});

describe("DeckSchema", () => {
  const wireCard = {
    id: "what-is-redis",
    topics: ["Redis"],
    questionHtml: "What is Redis?",
    answerHtml: "<p>A store.</p>",
  };
  const deck = { version: "abcdefghijkl", topics: ["Redis"], cards: [wireCard] };

  test("accepts the wire shape", () => {
    expect(DeckSchema.parse(deck)).toEqual(deck);
  });

  test("rejects an unknown key and a missing field", () => {
    expect(DeckSchema.safeParse({ ...deck, cards: [{ ...wireCard, answer: "A store." }] }).success).toBe(false);
    expect(DeckSchema.safeParse({ ...deck, version: undefined }).success).toBe(false);
  });
});
