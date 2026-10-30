// To do:
// [x] flingDuration: 3.5·d / max(|v|, 0.6), clamped to [180, 320] ms
// [x] flingEasing: cubic-bezier(0.2, y1, 0.3, 1) with y1 = clamp(0.2·|v|·T/d, 0.1, 0.7), so the card leaves at its release speed
// [x] MOTION: the cancel, deal and fade timings of plan §4; the commit easing for a commit without a release speed
import { describe, expect, test } from "vitest";
import { flingDuration, flingEasing, MOTION } from "./timing";

describe("flingDuration", () => {
  test("a release without speed takes the longest, 320 ms", () => {
    expect(flingDuration(800, 0)).toBe(320);
  });

  test("in between, the card covers the rest at its release speed, whichever way it goes", () => {
    expect(flingDuration(700, 10)).toBe(245);
    expect(flingDuration(700, -10)).toBe(245);
  });

  test("a very fast flick still takes 180 ms", () => {
    expect(flingDuration(300, 10)).toBe(180);
  });
});

describe("flingEasing", () => {
  test("a release without speed starts gently", () => {
    expect(flingEasing(800, 0)).toBe("cubic-bezier(0.2, 0.1, 0.3, 1)");
  });

  test("when the duration is clamped, the curve starts at the release speed", () => {
    // T = 320 ms; to start at 2.5 px/ms the curve's initial slope is 2.5·320/800 = 1, so y1 = 0.2·1.
    expect(flingEasing(800, -2.5)).toBe("cubic-bezier(0.2, 0.2, 0.3, 1)");
  });

  test("gives y1 to three decimals", () => {
    expect(flingEasing(960, 2.5)).toBe("cubic-bezier(0.2, 0.167, 0.3, 1)");
  });

  test("never starts steeper than the 3.5 the duration assumes", () => {
    expect(flingEasing(700, 10)).toBe("cubic-bezier(0.2, 0.7, 0.3, 1)");
    expect(flingEasing(300, 10)).toBe("cubic-bezier(0.2, 0.7, 0.3, 1)");
  });
});

describe("MOTION", () => {
  test("holds the cancel, deal and fade timings of the plan", () => {
    expect(MOTION).toMatchObject({
      cancelMs: 260,
      cancelEase: "cubic-bezier(0.3, 1.25, 0.5, 1)",
      dealMs: 220,
      dealEase: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      fadeMs: 140,
    });
  });

  test("a commit without a release speed (a key, a button) leaves at once, on the steepest fling curve", () => {
    expect(MOTION.commitEase).toBe(flingEasing(700, 10));
  });
});
