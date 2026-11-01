import { useEffect, useMemo, useState } from "react";
import type { Deck } from "../../shared/types";
import { atEnd, deal, flip, next, pageBack, poolFor, prev, reselect, reshuffle } from "./deck";
import { loadSelection, saveSelection, toggle } from "./selection";
import type { DeckView, Pass, Rng } from "./types";

interface State {
  deck: Deck;
  selected: ReadonlySet<string>;
  pass: Pass;
}

// localStorage, or none where the browser blocks it: then merely reading the property throws.
function browserStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function start(deck: Deck, selected: ReadonlySet<string>, rng: Rng): State {
  return { deck, selected, pass: deal(poolFor(deck.cards, selected), rng) };
}

export function useDeck(
  deck: Deck,
  { rng = Math.random, storage = browserStorage() }: { rng?: Rng; storage?: Storage | null } = {},
): DeckView {
  const [state, setState] = useState(() => start(deck, loadSelection(storage, deck.topics), rng));
  const { selected, pass } = state;
  useEffect(() => {
    saveSelection(storage, selected);
  }, [storage, selected]);
  // Every action reads the deck from the state, never from a render, so they keep their identity.
  const actions = useMemo(() => {
    // A move that changes nothing keeps the state, so React skips the render.
    const move = (f: (s: State) => Pass) =>
      setState((s) => {
        const pass = f(s);
        return pass === s.pass ? s : { ...s, pass };
      });
    const again = (s: State) => reshuffle(s.pass, poolFor(s.deck.cards, s.selected), rng);
    const choose = (s: State, selected: ReadonlySet<string>): State => ({
      ...s,
      selected,
      pass: reselect(s.pass, poolFor(s.deck.cards, selected), rng),
    });
    // How many pages the card on top has: 1 on the end card, which has no back.
    const pagesOf = (s: State) =>
      s.deck.cards.find((c) => c.id === s.pass.order[s.pass.index])?.answerPages.length ?? 1;
    return {
      flip: () => move((s) => flip(s.pass, pagesOf(s))),
      pageBack: () => move((s) => pageBack(s.pass)),
      goNext: () => move((s) => (atEnd(s.pass) ? again(s) : next(s.pass))),
      goPrev: () => move((s) => prev(s.pass)),
      reshuffle: () => move(again),
      toggleTopic: (label: string) => setState((s) => choose(s, toggle(s.selected, label))),
      clearTopics: () => setState((s) => (s.selected.size > 0 ? choose(s, new Set()) : s)),
    };
  }, [rng]);
  const at = (i: number) => state.deck.cards.find((c) => c.id === pass.order[i]) ?? null;
  return {
    prev: at(pass.index - 1),
    current: at(pass.index) ?? "end",
    next: atEnd(pass) ? null : (at(pass.index + 1) ?? "end"),
    side: pass.side,
    page: pass.page + 1,
    pages: at(pass.index)?.answerPages.length ?? 1,
    position: pass.index + 1,
    total: pass.order.length,
    selected,
    ...actions,
  };
}
