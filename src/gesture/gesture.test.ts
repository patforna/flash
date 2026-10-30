// To do:
// - classify: under the slop pending; horizontal when |dx| ≥ 1.2·|dy| as the slop is crossed, otherwise vertical
// - isTap: moved under 10 px and lasted at most 350 ms
// - velocityX: least squares over the last 80 ms; older samples ignored; one sample gives 0
// - release: 28 % of the width, or 0.45 px/ms with |dx| ≥ 24; a fling against the drag cancels; only what `can` allows
// - rubberBand: 0 gives 0, monotonic, always below 80
import { describe, expect, test } from "vitest";
import { classify, isTap, velocityX } from "./gesture";

const at = (x: number, y: number, t = 0) => ({ t, x, y });

describe("classify", () => {
  test("a pointer that hasn't moved is still pending", () => {
    expect(classify(at(100, 100), at(100, 100))).toBe("pending");
  });

  test("crossing the slop mostly sideways is horizontal", () => {
    expect(classify(at(100, 100), at(88, 110))).toBe("horizontal");
  });

  test("crossing the slop any steeper is vertical", () => {
    expect(classify(at(100, 100), at(89, 110))).toBe("vertical");
  });

  test("a move just inside the slop is still pending", () => {
    expect(classify(at(100, 100), at(106, 107.9))).toBe("pending");
  });
});

describe("isTap", () => {
  test("a press lifted where it went down within 350 ms is a tap", () => {
    expect(isTap(at(100, 100, 0), at(103, 104, 350))).toBe(true);
  });

  test("a longer hold is not a tap", () => {
    expect(isTap(at(100, 100, 0), at(100, 100, 351))).toBe(false);
  });

  test("lifting 10 px away is not a tap", () => {
    expect(isTap(at(100, 100, 0), at(106, 108, 100))).toBe(false);
  });
});

describe("velocityX", () => {
  test("one sample gives no velocity", () => {
    expect(velocityX([at(100, 100, 0)])).toBe(0);
  });

  test("a steady drag left gives its speed in px/ms", () => {
    expect(velocityX([at(700, 0, 0), at(680, 0, 8), at(660, 0, 16), at(640, 0, 24)])).toBeCloseTo(-2.5);
  });

  test("an uneven drag gives the least-squares slope, not the end points' (0.67)", () => {
    expect(velocityX([at(0, 0, 0), at(0, 0, 8), at(16, 0, 16), at(16, 0, 24)])).toBeCloseTo(0.8);
  });
});
