// To do:
// - [x] the first render deals a pass of the whole deck: card 1 of 5, front up, nothing before it
// - [x] goNext walks the pass, every card once, then the end card
// - [x] next is the card after this one, "end" after the last card and null on the end card; prev the card before
// - [x] goPrev goes back a card; from the end card to the last card
// - [x] flip turns the card over; landing on any card shows its front
// - [x] goNext on the end card reshuffles, never starting with the last card seen
// - [x] reshuffle deals a new pass, never starting with the card on screen
// - [x] the first render deals a pass of the stored selection
// - [x] toggleTopic keeps the card on screen, on the same side, when it still matches; the pass is the new pool
// - [x] toggleTopic deals afresh, front up, when the card on screen no longer matches
// - [x] toggleTopic and clearTopics persist the selection
// - [x] clearTopics returns to every card; with nothing selected it changes nothing
// - [x] a new deck (a different version) keeps the selection, drops unknown topics and deals afresh
// - [x] the same version in a new object changes nothing
// - [x] the callbacks keep their identity across renders
// - [x] localStorage by default; a blocked localStorage is ignored

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("deals a new pass with reshuffle, never starting with the card on screen", () => {
    const { result } = setup();
    for (let n = 0; n < 10; n++) {
      act(() => result.current.goNext());
      const shown = result.current.current;
      act(() => result.current.reshuffle());
      expect(result.current).toMatchObject({ position: 1, total: 5, side: "front" });
      expect(result.current.current).not.toBe(shown);
    }
  });

  it("deals a pass of the stored selection on the first render", () => {
    const { result } = setup({ stored: '["Queues"]' });
    expect(result.current.selected).toEqual(new Set(["Queues"]));
    expect(walk(result).toSorted()).toEqual(["c", "d"]);
  });

  it("keeps the card on screen, on the same side, when a topic it carries is toggled on", () => {
    const { result } = setup();
    act(() => result.current.goNext());
    act(() => result.current.flip());
    const shown = result.current.current as Card;
    const topic = shown.topics[0] as string;
    act(() => result.current.toggleTopic(topic));
    expect(result.current).toMatchObject({ prev: null, current: shown, side: "back", position: 1 });
    expect(result.current.selected).toEqual(new Set([topic]));
    expect(walk(result).toSorted()).toEqual(deck.cards.filter((c) => c.topics.includes(topic)).map((c) => c.id));
  });

  it("deals afresh, front up, when the card on screen doesn't carry the topic toggled on", () => {
    const { result } = setup();
    act(() => result.current.flip());
    const shown = result.current.current as Card;
    const topic = deck.topics.find((t) => !shown.topics.includes(t)) as string;
    act(() => result.current.toggleTopic(topic));
    expect(result.current).toMatchObject({ prev: null, side: "front", position: 1 });
    expect(result.current.current).not.toBe(shown);
    expect(walk(result).toSorted()).toEqual(deck.cards.filter((c) => c.topics.includes(topic)).map((c) => c.id));
  });

  it("saves the selection when a topic is toggled", () => {
    const { result, storage } = setup();
    act(() => result.current.toggleTopic("Queues"));
    act(() => result.current.toggleTopic("Redis"));
    expect(storage.getItem("flash:v1:topics")).toBe('["Queues","Redis"]');
  });

  it("returns to every card with clearTopics, keeping the card on screen, and saves the empty selection", () => {
    const { result, storage } = setup({ stored: '["Queues"]' });
    const shown = result.current.current;
    act(() => result.current.clearTopics());
    expect(result.current).toMatchObject({ current: shown, position: 1, total: 5 });
    expect(result.current.selected).toEqual(new Set());
    expect(storage.getItem("flash:v1:topics")).toBe("[]");
  });

  it("changes nothing with clearTopics when nothing is selected, so the pass isn't reshuffled", () => {
    const { result } = setup();
    act(() => result.current.goNext());
    const { prev, current, next } = result.current;
    act(() => result.current.clearTopics());
    expect(result.current).toMatchObject({ prev, current, next, position: 2 });
  });

  it("keeps the selection on a new deck, drops topics it no longer has, and deals afresh", () => {
    const { result, rerender } = setup({ stored: '["Redis","Queues"]' });
    act(() => result.current.goNext());
    act(() => result.current.flip());
    rerender({ version: "v2", topics: ["Redis", "Postgres"], cards: [card("a", "Redis"), card("b"), card("f", "Redis")] });
    expect(result.current.selected).toEqual(new Set(["Redis"]));
    expect(result.current).toMatchObject({ prev: null, side: "front", position: 1, total: 2, topics: ["Redis", "Postgres"] });
    expect(walk(result).toSorted()).toEqual(["a", "f"]);
  });

  it("changes nothing for the same deck version in a new object", () => {
    const { result, rerender } = setup();
    act(() => result.current.goNext());
    const { prev, current } = result.current;
    rerender({ ...deck });
    expect(result.current).toMatchObject({ prev, current, position: 2 });
  });

  it("keeps its callbacks across renders, so the stage can hold on to them", () => {
    const { result, rerender } = setup();
    const before = result.current;
    act(() => result.current.flip());
    act(() => result.current.goNext());
    act(() => result.current.toggleTopic("Redis"));
    act(() => result.current.clearTopics());
    rerender(deck);
    for (const name of ["flip", "goNext", "goPrev", "reshuffle", "toggleTopic", "clearTopics"] as const) {
      expect(result.current[name], name).toBe(before[name]);
    }
  });
});

describe("useDeck without an injected storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("reads and saves the selection in localStorage", () => {
    localStorage.setItem("flash:v1:topics", '["Queues"]');
    const { result } = renderHook(() => useDeck(deck, { rng: mulberry32(2) }), { reactStrictMode: true });
    expect(result.current.selected).toEqual(new Set(["Queues"]));
    act(() => result.current.toggleTopic("Redis"));
    expect(localStorage.getItem("flash:v1:topics")).toBe('["Queues","Redis"]');
  });

  it("deals the whole deck, and still selects, when localStorage is blocked", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    const { result } = renderHook(() => useDeck(deck, { rng: mulberry32(3) }), { reactStrictMode: true });
    expect(result.current).toMatchObject({ position: 1, total: 5 });
    act(() => result.current.toggleTopic("Redis"));
    expect(result.current.selected).toEqual(new Set(["Redis"]));
  });
});
