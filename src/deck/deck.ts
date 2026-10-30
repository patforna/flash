import type { Rng } from "./types";

// Fisher–Yates, on a copy.
export function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) swap(out, i, Math.floor(rng() * (i + 1)));
  return out;
}

function swap<T>(xs: T[], i: number, j: number): void {
  [xs[i], xs[j]] = [xs[j] as T, xs[i] as T];
}
