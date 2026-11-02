// To do:
// [x] a card is always written at the same angle: the tilt follows from its id
// [x] the question only ever rises from left to right, by 0.6° to 2.2°, or lies level
// [x] about two cards in three are slanted, the rest level
import { describe, expect, it } from "vitest";
import { tiltFor } from "./tilt";

const ids = Array.from({ length: 2000 }, (_, i) => `question-${i}-${(i * 7919).toString(36)}`);

describe("tiltFor", () => {
  it("gives a card the same angle every time", () => {
    expect(tiltFor("why-does-postgres-need-vacuum")).toBe(tiltFor("why-does-postgres-need-vacuum"));
  });

  it("only ever rises, by 0.6° to 2.2°, or lies level", () => {
    for (const id of ids) {
      const tilt = tiltFor(id);
      if (tilt !== 0) {
        expect(tilt).toBeGreaterThanOrEqual(-2.2);
        expect(tilt).toBeLessThanOrEqual(-0.6);
      }
    }
  });

  it("slants about two cards in three", () => {
    const slanted = ids.filter((id) => tiltFor(id) !== 0).length / ids.length;
    expect(slanted).toBeGreaterThan(0.62);
    expect(slanted).toBeLessThan(0.72);
  });

  it("spreads the slanted cards over the whole range", () => {
    const tilts = ids.map(tiltFor).filter((tilt) => tilt !== 0);
    expect(Math.min(...tilts)).toBeLessThan(-2.1);
    expect(Math.max(...tilts)).toBeGreaterThan(-0.7);
  });
});
