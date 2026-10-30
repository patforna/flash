import type { Card } from "../../shared/types";
import type { Rng } from "./types";

// The cards carrying any selected topic, in file order. Nothing selected, or only topics no card carries, means every card.
export function poolFor(cards: readonly Card[], selected: ReadonlySet<string>): string[] {
  const chosen = cards.filter((c) => c.topics.some((t) => selected.has(t)));
  return (chosen.length > 0 ? chosen : cards).map((c) => c.id);
}

// Fisher–Yates, on a copy.
export function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) swap(out, i, Math.floor(rng() * (i + 1)));
  return out;
}

function swap<T>(xs: T[], i: number, j: number): void {
  [xs[i], xs[j]] = [xs[j] as T, xs[i] as T];
}
