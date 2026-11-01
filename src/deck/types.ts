// Types only, frozen in M0: the stage and the card build against these while the engine is built in parallel.
import type { Card } from "../../shared/types";

export type Rng = () => number; // [0, 1)
export type Side = "front" | "back";
export interface Pass {
  order: readonly string[];
  index: number; // index === order.length → end card
  side: Side;
  page: number; // 0-based, into the current card's answerPages; 0 on the front
}
export interface DeckView {
  prev: Card | null;
  current: Card | "end";
  next: Card | "end" | null;
  side: Side;
  page: number; // 1-based: the page of the answer on show
  pages: number; // how many the current card's answer has (1 on the end card)
  position: number; // 1-based
  total: number; // pass size
  selected: ReadonlySet<string>;
  // On the front: show the back's first page. On the back: the next page, and from the last page the front.
  flip(): void;
  pageBack(): void; // the page before, on the back, and from page 1 the front; a no-op on the front
  goNext(): void;
  goPrev(): void;
  reshuffle(): void;
  toggleTopic(label: string): void;
  clearTopics(): void; // empties the selection (= All)
}
