import { STICKERS } from "../../shared/stickers";

export function colourFor(index: number): string {
  return `var(--s-${STICKERS[index % STICKERS.length]})`;
}
