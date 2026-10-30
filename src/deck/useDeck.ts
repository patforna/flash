import { useState } from "react";
import type { Deck } from "../../shared/types";
import { deal, flip, next, poolFor, prev, reshuffle } from "./deck";
import { loadSelection } from "./selection";
import type { DeckView, Pass, Rng } from "./types";

const none = () => {};

export function useDeck(
  deck: Deck,
  { rng = Math.random, storage = null }: { rng?: Rng; storage?: Storage | null } = {},
): DeckView {
  const [selected] = useState(() => loadSelection(storage, deck.topics));
  const [pass, setPass] = useState(() => deal(poolFor(deck.cards, selected), rng));
  const at = (i: number) => deck.cards.find((c) => c.id === pass.order[i]) ?? null;
  const again = (p: Pass) => reshuffle(p, poolFor(deck.cards, selected), rng);
  return {
    prev: at(pass.index - 1),
    current: at(pass.index) ?? "end",
    next: pass.index < pass.order.length ? (at(pass.index + 1) ?? "end") : null,
    side: pass.side,
    position: pass.index + 1,
    total: pass.order.length,
    selected,
    topics: deck.topics,
    flip: () => setPass(flip),
    goNext: () => setPass((p) => (p.index < p.order.length ? next(p) : again(p))),
    goPrev: () => setPass(prev),
    reshuffle: () => setPass(again),
    toggleTopic: none,
    clearTopics: none,
  };
}
