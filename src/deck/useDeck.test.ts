// To do:
// - [x] the first render deals a pass of the whole deck: card 1 of 5, front up, nothing before it
// - [x] goNext walks the pass, every card once, then the end card
// - [x] next is the card after this one, "end" after the last card and null on the end card; prev the card before
// - [x] goPrev goes back a card; from the end card to the last card
// - [x] flip turns the card over; landing on any card shows its front
// - [x] goNext on the end card reshuffles, never starting with the last card seen
// - [ ] reshuffle deals a new pass, never starting with the card on screen
// - [ ] the first render deals a pass of the stored selection
// - [ ] toggleTopic keeps the card on screen, on the same side, when it still matches; the pass is the new pool
// - [ ] toggleTopic deals afresh, front up, when the card on screen no longer matches
// - [ ] toggleTopic and clearTopics persist the selection
// - [ ] clearTopics returns to every card; with nothing selected it changes nothing
// - [ ] a new deck (a different version) keeps the selection, drops unknown topics and deals afresh
// - [ ] the same version in a new object changes nothing
// - [ ] the callbacks keep their identity across renders
// - [ ] localStorage by default; a blocked localStorage is ignored

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Card, Deck } from "../../shared/types";
import type { DeckView, Rng } from "./types";
import { useDeck } from "./useDeck";

const card = (id: string, ...topics: string[]): Card => ({ id, topics, questionHtml: id, answerHtml: id });
const deck: Deck = {
  version: "v1",
  topics: ["Redis", "Postgres", "Queues"],
  cards: [card("a", "Redis"), card("b", "Postgres"), card("c", "Redis", "Queues"), card("d", "Queues"), card("e", "Postgres")],
};

// A seeded generator, so every run deals the same way.
function mulberry32(seed: number): Rng {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Renders the hook in StrictMode with a seeded rng and a fresh storage, holding `stored` as the saved selection.
function setup({ stored }: { stored?: string } = {}) {
  const storage = new Storage();
  if (stored !== undefined) storage.setItem("flash:v1:topics", stored);
  const rng = mulberry32(1);
  const hook = renderHook((d: Deck) => useDeck(d, { rng, storage }), { initialProps: deck, reactStrictMode: true });
  return { ...hook, storage };
}

// Steps through the pass with goNext from the card on screen; the ids of the cards seen before the end card.
function walk(result: { current: DeckView }): string[] {
  const ids: string[] = [];
  for (let n = 0; n < 20; n++) {
    const view = result.current;
    if (view.current === "end") break;
    ids.push(view.current.id);
    act(() => view.goNext());
  }
  return ids;
}

describe("useDeck", () => {
  it("deals a pass of the whole deck on the first render", () => {
    const { result } = setup();
    expect(result.current).toMatchObject({ prev: null, side: "front", position: 1, total: 5, topics: deck.topics });
    expect(result.current.selected).toEqual(new Set());
    expect(deck.cards).toContain(result.current.current);
  });

  it("walks the pass with goNext, every card once, then the end card", () => {
    const { result } = setup();
    expect(walk(result).toSorted()).toEqual(["a", "b", "c", "d", "e"]);
    expect(result.current).toMatchObject({ current: "end", position: 6, total: 5 });
  });

  it("shows the cards either side: next is the end card after the last card, and nothing after the end card", () => {
    const { result } = setup();
    const { current: first, next: second } = result.current;
    act(() => result.current.goNext());
    expect(result.current).toMatchObject({ prev: first, current: second });
    for (let n = 0; n < 3; n++) act(() => result.current.goNext());
    const last = result.current.current;
    expect(result.current.next).toBe("end");
    act(() => result.current.goNext());
    expect(result.current).toMatchObject({ prev: last, current: "end", next: null });
  });

  it("goes back a card with goPrev, and from the end card to the last card", () => {
    const { result } = setup();
    const first = result.current.current;
    act(() => result.current.goNext());
    act(() => result.current.goPrev());
    expect(result.current).toMatchObject({ current: first, position: 1 });
    const seen = walk(result);
    act(() => result.current.goPrev());
    expect(result.current).toMatchObject({ current: { id: seen.at(-1) }, position: 5 });
  });

  it("turns the card over with flip, and shows the front of every card it lands on", () => {
    const { result } = setup();
    act(() => result.current.flip());
    expect(result.current.side).toBe("back");
    act(() => result.current.goNext());
    expect(result.current.side).toBe("front");
    act(() => result.current.flip());
    act(() => result.current.goPrev());
    expect(result.current.side).toBe("front");
  });

  it("reshuffles with goNext on the end card, never starting with the last card seen", () => {
    const { result } = setup();
    for (let pass = 0; pass < 10; pass++) {
      const last = walk(result).at(-1);
      act(() => result.current.goNext());
      expect(result.current).toMatchObject({ position: 1, total: 5, side: "front" });
      expect(result.current.current).not.toMatchObject({ id: last });
    }
  });
});
