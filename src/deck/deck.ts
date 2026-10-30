import type { Rng } from "./types";

export function shuffle<T>(xs: readonly T[], _rng: Rng): T[] {
  return [...xs];
}
