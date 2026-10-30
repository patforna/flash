// To do:
// - [x] shuffle is a permutation of its input
// - [ ] shuffle is deterministic for a seeded rng
// - [ ] shuffle never mutates its input
// - [ ] shuffle puts every item in every position (a real shuffle, not a fixed rearrangement)
// - [ ] poolFor: an empty selection gives every card id in file order
// - [ ] poolFor: OR across the selected topics, in file order
// - [ ] poolFor: unknown topics are ignored
// - [ ] deal: a shuffled pass of the pool at index 0, front up
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
import { shuffle } from "./deck";
import type { Rng } from "./types";

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
});
