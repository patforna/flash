// Types only, frozen in M0: the stage and the card build against these while the engine is built in parallel.
import type { Card } from "../../shared/types";

export type Rng = () => number; // [0, 1)
export type Side = "front" | "back";
export interface Pass {
  order: readonly string[];
  index: number; // index === order.length → end card
  side: Side;
  page: number; // 0-based, the page of the back shown; 0 on the front
}
export interface DeckView {
  prev: Card | null;
  current: Card | "end";
  next: Card | "end" | null;
  side: Side;
  page: number; // 0-based
  pages: number; // the current card's, 1 for the end card
  position: number; // 1-based
  total: number; // pass size
  selected: ReadonlySet<string>;
  flip(): void;
  nextPage(): void;
  prevPage(): void;
  goNext(): void;
  goPrev(): void;
  reshuffle(): void;
  toggleTopic(label: string): void;
  clearTopics(): void; // empties the selection (= All)
}
