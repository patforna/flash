// To do:
// [x] CardsFileSchema accepts topics and cards
// [x] it rejects an unknown key at the top level and on a card (catches `topic =`)
// [x] DeckSchema accepts the wire shape and rejects anything else
// [x] a change to the wire's shape fails until WIRE goes up, its shape recorded
// Run by `bun test`, which serves vitest's API: shared/ is in the browser program too, which has no `bun:test`.
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { CardsFileSchema, DeckSchema } from "./schema";
import { WIRE } from "./types";

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
    answerPages: ["<p>A store.</p>"],
  };
  const deck = { wire: WIRE, version: "abcdefghijkl", topics: ["Redis"], cards: [wireCard] };

  test("accepts the wire shape", () => {
    expect(DeckSchema.parse(deck)).toEqual(deck);
  });

  test("rejects an unknown key and a missing field", () => {
    expect(DeckSchema.safeParse({ ...deck, cards: [{ ...wireCard, answer: "A store." }] }).success).toBe(false);
    expect(DeckSchema.safeParse({ ...deck, version: undefined }).success).toBe(false);
  });
});

// Every wire there has been, with its shape's fingerprint: never edit a line, add one. The client reloads into new code
// only on a deck in another wire (src/api/client.ts), so a shape that changes under the same WIRE reaches code that
// can't read it, as on 2 Nov 2026, when every back on the phone was blank.
const SHAPES: Record<number, string> = {
  1: "67a914ce4642b21e",
};

describe("WIRE", () => {
  test("names the wire's shape: a change to DeckSchema fails here until WIRE goes up and its shape is added", async () => {
    const json = new TextEncoder().encode(JSON.stringify(z.toJSONSchema(DeckSchema)));
    const sha = new Uint8Array(await crypto.subtle.digest("SHA-256", json));
    const shape = Array.from(sha.slice(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("");

    expect({ wire: WIRE, shape }).toEqual({ wire: Math.max(...Object.keys(SHAPES).map(Number)), shape: SHAPES[WIRE] });
  });
});
