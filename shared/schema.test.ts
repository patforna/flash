// To do:
// [x] CardsFileSchema accepts topics and cards
// [ ] it rejects an unknown key at the top level and on a card (catches `topic =`)
// [ ] it rejects a missing field and a field of the wrong type
// [ ] DeckSchema accepts the wire shape and rejects anything else
import { describe, expect, test } from "bun:test";
import { CardsFileSchema } from "./schema";

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
