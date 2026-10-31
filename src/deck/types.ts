// Types only, frozen in M0: the stage and the card build against these while the engine is built in parallel.
import type { Card } from "../../shared/types";

export type Rng = () => number; // [0, 1)
export type Side = "front" | "back";
export interface Pass {
  order: readonly string[];
  index: number; // index === order.length → end card
  side: Side;
}
export interface DeckView {
  prev: Card | null;
  current: Card | "end";
  next: Card | "end" | null;
  side: Side;
  position: number; // 1-based
  total: number; // pass size
  selected: ReadonlySet<string>;
  flip(): void;
  goNext(): void;
  goPrev(): void;
  reshuffle(): void;
  toggleTopic(label: string): void;
  clearTopics(): void; // empties the selection (= All)
}
