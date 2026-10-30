import { useEffect, useState } from "react";
import type { Deck } from "../../shared/types";
import { deal, flip, next, poolFor, prev, reselect, reshuffle } from "./deck";
import { loadSelection, saveSelection, toggle } from "./selection";
import type { DeckView, Pass, Rng } from "./types";

interface State {
  deck: Deck;
  selected: ReadonlySet<string>;
  pass: Pass;
}

function start(deck: Deck, selected: ReadonlySet<string>, rng: Rng): State {
  return { deck, selected, pass: deal(poolFor(deck.cards, selected), rng) };
}

export function useDeck(
  deck: Deck,
  { rng = Math.random, storage = null }: { rng?: Rng; storage?: Storage | null } = {},
): DeckView {
  const [state, setState] = useState(() => start(deck, loadSelection(storage, deck.topics), rng));
  if (state.deck.version !== deck.version) {
    // A new deck: keep the topics it still has and deal afresh. React renders again straight away.
    setState(start(deck, new Set(deck.topics.filter((t) => state.selected.has(t))), rng));
  }
  const { selected, pass } = state;
  useEffect(() => {
    saveSelection(storage, selected);
  }, [storage, selected]);
  const move = (f: (s: State) => Pass) => setState((s) => ({ ...s, pass: f(s) }));
  const again = (s: State) => reshuffle(s.pass, poolFor(s.deck.cards, s.selected), rng);
  const choose = (s: State, selected: ReadonlySet<string>): State => ({
    ...s,
    selected,
    pass: reselect(s.pass, poolFor(s.deck.cards, selected), rng),
  });
  const at = (i: number) => state.deck.cards.find((c) => c.id === pass.order[i]) ?? null;
  return {
    prev: at(pass.index - 1),
    current: at(pass.index) ?? "end",
    next: pass.index < pass.order.length ? (at(pass.index + 1) ?? "end") : null,
    side: pass.side,
    position: pass.index + 1,
    total: pass.order.length,
    selected,
    topics: state.deck.topics,
    flip: () => move((s) => flip(s.pass)),
    goNext: () => move((s) => (s.pass.index < s.pass.order.length ? next(s.pass) : again(s))),
    goPrev: () => move((s) => prev(s.pass)),
    reshuffle: () => move(again),
    toggleTopic: (label) => setState((s) => choose(s, toggle(s.selected, label))),
    clearTopics: () => setState((s) => (s.selected.size > 0 ? choose(s, new Set()) : s)),
  };
}
