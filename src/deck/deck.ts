import type { Card } from "../../shared/types";
import type { Pass, Rng } from "./types";

// The cards carrying any selected topic, in file order. Nothing selected, or only topics no card carries, means every card.
export function poolFor(cards: readonly Card[], selected: ReadonlySet<string>): string[] {
  const chosen = cards.filter((c) => c.topics.some((t) => selected.has(t)));
  return (chosen.length > 0 ? chosen : cards).map((c) => c.id);
}

export function deal(
  pool: readonly string[],
  rng: Rng,
  { keep, avoidFirst }: { keep?: string; avoidFirst?: string } = {},
): Pass {
  const order = shuffle(pool, rng);
  if (keep !== undefined && order.includes(keep)) swap(order, 0, order.indexOf(keep));
  if (order.length > 1 && order[0] === avoidFirst) swap(order, 0, 1 + Math.floor(rng() * (order.length - 1)));
  return { order, index: 0, side: "front" };
}

const atEnd = (p: Pass) => p.index === p.order.length;

export function flip(p: Pass): Pass {
  return atEnd(p) ? p : { ...p, side: p.side === "front" ? "back" : "front" };
}

export function next(p: Pass): Pass {
  return atEnd(p) ? p : { ...p, index: p.index + 1, side: "front" };
}

export function prev(p: Pass): Pass {
  return p.index > 0 ? { ...p, index: p.index - 1, side: "front" } : p;
}

// A new pass that never starts with the card just seen: the current one, or the last one from the end card.
export function reshuffle(p: Pass, pool: readonly string[], rng: Rng): Pass {
  return deal(pool, rng, { avoidFirst: p.order[atEnd(p) ? p.index - 1 : p.index] });
}

// After a selection change the card on screen stays, first and on the same side, if the new pool has it.
export function reselect(p: Pass, pool: readonly string[], rng: Rng): Pass {
  const current = p.order[p.index];
  if (current === undefined || !pool.includes(current)) return deal(pool, rng);
  return { ...deal(pool, rng, { keep: current }), side: p.side };
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
