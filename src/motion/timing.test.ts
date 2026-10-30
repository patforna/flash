// To do:
// - flingDuration: 3.5·d / max(|v|, 0.6), clamped to [180, 320] ms
// - flingEasing: cubic-bezier(0.2, y1, 0.3, 1) with y1 = clamp(0.2·|v|·T/d, 0.1, 0.7), so the card leaves at its release speed
// - MOTION: the cancel, deal and fade timings of plan §4; the commit easing for a commit without a release speed
import { describe, expect, test } from "vitest";
import { flingDuration } from "./timing";

describe("flingDuration", () => {
  test("a release without speed takes the longest, 320 ms", () => {
    expect(flingDuration(800, 0)).toBe(320);
  });
});
