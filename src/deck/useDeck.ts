import { useState } from "react";
import type { Deck } from "../../shared/types";
import { deal, flip, next, poolFor, prev } from "./deck";
import type { DeckView, Rng } from "./types";

const none = () => {};

export function useDeck(deck: Deck, { rng = Math.random }: { rng?: Rng; storage?: Storage | null } = {}): DeckView {
  const [pass, setPass] = useState(() => deal(poolFor(deck.cards, new Set()), rng));
  const at = (i: number) => deck.cards.find((c) => c.id === pass.order[i]) ?? null;
  return {
    prev: at(pass.index - 1),
    current: at(pass.index) ?? "end",
    next: pass.index < pass.order.length ? (at(pass.index + 1) ?? "end") : null,
    side: pass.side,
    position: pass.index + 1,
    total: pass.order.length,
    selected: new Set(),
    topics: deck.topics,
    flip: () => setPass(flip),
    goNext: () => setPass(next),
    goPrev: () => setPass(prev),
    reshuffle: none,
    toggleTopic: none,
    clearTopics: none,
  };
}
