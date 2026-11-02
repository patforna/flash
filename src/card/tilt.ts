import { fnv1a } from "./seed";

// A question written by hand rarely lies dead level: two cards in three rise from left to right by 0.6° to 2.2° (as a
// CSS rotation, negative), the rest lie level. A falling line sags, and more than about 2° reads as a design tilt. The
// angle follows from the card's id, so a card is written the same way every time it comes round.
export function tiltFor(id: string): number {
  const hash = fnv1a(id);
  const slanted = (hash & 0xffff) / 0x10000;
  const amount = (hash >>> 16) / 0x10000;
  return slanted < 2 / 3 ? -Math.round((0.6 + 1.6 * amount) * 100) / 100 : 0;
}
