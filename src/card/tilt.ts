// A question written by hand rarely lies dead level: two cards in three rise from left to right by 0.6° to 2.2° (as a
// CSS rotation, negative), the rest lie level. A falling line sags, and more than about 2° reads as a design tilt. The
// angle follows from the card's id, so a card is written the same way every time it comes round.
export function tiltFor(id: string): number {
  const hash = fnv1a(id);
  const slanted = (hash & 0xffff) / 0x10000;
  const amount = (hash >>> 16) / 0x10000;
  return slanted < 2 / 3 ? -Math.round((0.6 + 1.6 * amount) * 100) / 100 : 0;
}

// 32-bit FNV-1a over the id's UTF-16 code units: small, and its bits spread well enough for an angle.
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
