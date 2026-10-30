// The sticker tokens in declared order (src/styles/tokens.css): a topic's colour is its declared index mod 8.
const STICKERS = ["pink", "marigold", "mint", "sky", "lilac", "tangerine", "teal", "lime"] as const;

export function colourFor(index: number): string {
  return `var(--s-${STICKERS[index % STICKERS.length]})`;
}
