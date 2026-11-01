// Scrolls `el` by `by` px in `dir` (1 down, -1 up) if it has room that way, and says whether it did. Smooth unless
// told otherwise (reduced motion). A long back's pages scroll by the keys this way before the key flips the card.
export function scrollBy(el: HTMLElement, dir: 1 | -1, by: number, smooth: boolean): boolean {
  const room = dir > 0 ? el.scrollHeight - el.clientHeight - el.scrollTop : el.scrollTop;
  if (room <= 1) return false;
  el.scrollBy({ top: dir * by, behavior: smooth ? "smooth" : "auto" });
  return true;
}
