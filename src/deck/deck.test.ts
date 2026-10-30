// To do:
// - [x] shuffle is a permutation of its input
// - [x] shuffle is deterministic for a seeded rng
// - [x] shuffle never mutates its input
// - [x] shuffle puts every item in every position (a real shuffle, not a fixed rearrangement)
// - [x] poolFor: an empty selection gives every card id in file order
// - [x] poolFor: OR across the selected topics, in file order
// - [x] poolFor: unknown topics are ignored
// - [x] deal: a shuffled pass of the pool at index 0, front up
// - [ ] deal: keep puts that id first; ignored when it isn't in the pool
// - [ ] deal: avoidFirst never starts the pass with that id when there are at least 2 cards
// - [ ] deal: avoidFirst moves it to any other position
// - [ ] deal: avoidFirst keeps a lone card
// - [ ] next: one forward, front up; past the last card the end card; a no-op on the end card
// - [ ] prev: one back, front up; a no-op at 0; from the end card the last card
// - [ ] flip toggles the side; a no-op on the end card (it has no back)
// - [ ] reshuffle: a new pass of the pool that never starts with the current card
// - [ ] reshuffle: on the end card, never starts with the last card
// - [ ] reselect: the current card, if still in the pool, first and on the same side
// - [ ] reselect: otherwise, or from the end card, a fresh deal, front up

import { describe, expect, it } from "vitest";
import type { Card } from "../../shared/types";
import { deal, poolFor, shuffle } from "./deck";
import type { Rng } from "./types";

const card = (id: string, ...topics: string[]): Card => ({ id, topics, questionHtml: id, answerHtml: id });
const cards = [card("a", "Redis"), card("b", "Postgres"), card("c", "Redis", "Queues"), card("d", "Queues")];

// A seeded generator, so every run shuffles the same way.
function mulberry32(seed: number): Rng {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("shuffle", () => {
  it("is a permutation of its input", () => {
    const xs = ["a", "b", "c", "d", "e"];
    expect(shuffle(xs, mulberry32(1)).toSorted()).toEqual(xs);
  });

  it("is deterministic for a seeded rng", () => {
    const xs = ["a", "b", "c", "d", "e", "f"];
    expect(shuffle(xs, mulberry32(7))).toEqual(shuffle(xs, mulberry32(7)));
  });

  it("never mutates its input", () => {
    const xs = ["a", "b", "c", "d", "e"];
    shuffle(xs, mulberry32(3));
    expect(xs).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("puts every item in every position", () => {
    const rng = mulberry32(2);
    const placings = new Set<string>();
    for (let n = 0; n < 100; n++) {
      for (const [i, x] of shuffle(["a", "b", "c", "d"], rng).entries()) placings.add(`${x} at ${i}`);
    }
    expect(placings.size).toBe(4 * 4);
  });
});

describe("poolFor", () => {
  it("gives every card id in file order when nothing is selected", () => {
    expect(poolFor(cards, new Set())).toEqual(["a", "b", "c", "d"]);
  });

  it("takes the cards carrying any selected topic, in file order", () => {
    expect(poolFor(cards, new Set(["Queues", "Redis"]))).toEqual(["a", "c", "d"]);
  });

  it("ignores unknown topics", () => {
    expect(poolFor(cards, new Set(["Redis", "Nope"]))).toEqual(["a", "c"]);
    expect(poolFor(cards, new Set(["Nope"]))).toEqual(["a", "b", "c", "d"]);
  });
});

describe("deal", () => {
  it("deals a shuffled pass of the pool at index 0, front up", () => {
    const pool = ["a", "b", "c", "d", "e"];
    expect(deal(pool, mulberry32(4))).toEqual({ order: shuffle(pool, mulberry32(4)), index: 0, side: "front" });
  });

  it("puts keep first and shuffles the rest", () => {
    const rng = mulberry32(5);
    const orders = new Set(Array.from({ length: 60 }, () => deal(["a", "b", "c"], rng, { keep: "b" }).order.join("")));
    expect(orders).toEqual(new Set(["bac", "bca"]));
  });
});
