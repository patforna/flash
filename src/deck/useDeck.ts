import { useState } from "react";
import type { Deck } from "../../shared/types";
import { deal, flip, next, poolFor, prev, reselect, reshuffle } from "./deck";
import { loadSelection, toggle } from "./selection";
import type { DeckView, Pass, Rng } from "./types";

interface State {
  selected: ReadonlySet<string>;
  pass: Pass;
}

const none = () => {};

export function useDeck(
  deck: Deck,
  { rng = Math.random, storage = null }: { rng?: Rng; storage?: Storage | null } = {},
): DeckView {
  const [{ selected, pass }, setState] = useState((): State => {
    const selected = loadSelection(storage, deck.topics);
    return { selected, pass: deal(poolFor(deck.cards, selected), rng) };
  });
  const move = (f: (s: State) => Pass) => setState((s) => ({ ...s, pass: f(s) }));
  const again = (s: State) => reshuffle(s.pass, poolFor(deck.cards, s.selected), rng);
  const at = (i: number) => deck.cards.find((c) => c.id === pass.order[i]) ?? null;
  return {
    prev: at(pass.index - 1),
    current: at(pass.index) ?? "end",
    next: pass.index < pass.order.length ? (at(pass.index + 1) ?? "end") : null,
    side: pass.side,
    position: pass.index + 1,
    total: pass.order.length,
    selected,
    topics: deck.topics,
    flip: () => move((s) => flip(s.pass)),
    goNext: () => move((s) => (s.pass.index < s.pass.order.length ? next(s.pass) : again(s))),
    goPrev: () => move((s) => prev(s.pass)),
    reshuffle: () => move(again),
    toggleTopic: (label) =>
      setState((s) => {
        const chosen = toggle(s.selected, label);
        return { selected: chosen, pass: reselect(s.pass, poolFor(deck.cards, chosen), rng) };
      }),
    clearTopics: none,
  };
}
