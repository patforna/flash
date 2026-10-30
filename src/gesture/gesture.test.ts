// To do:
// - classify: under the slop pending; horizontal when |dx| ≥ 1.2·|dy| as the slop is crossed, otherwise vertical
// - isTap: moved under 10 px and lasted at most 350 ms
// - velocityX: least squares over the last 80 ms; older samples ignored; one sample gives 0
// - release: 28 % of the width, or 0.45 px/ms with |dx| ≥ 24; a fling against the drag cancels; only what `can` allows
// - rubberBand: 0 gives 0, monotonic, always below 80
import { describe, expect, test } from "vitest";
import { classify, isTap, release, velocityX } from "./gesture";

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

  test("samples older than the last 80 ms are ignored", () => {
    const flick = [at(0, 0, 0), at(300, 0, 10)];
    const settle = [at(300, 0, 100), at(310, 0, 140), at(320, 0, 180)];
    expect(velocityX([...flick, ...settle])).toBeCloseTo(0.25);
  });
});

describe("release", () => {
  const width = 600; // 28 % is 168 px
  const both = { prev: true, next: true };

  test("a short, slow drag cancels", () => {
    expect(release(-50, -0.1, width, both)).toBe("cancel");
  });

  test("dragging left 28 % of the width commits next", () => {
    expect(release(-168, 0, width, both)).toBe("next");
  });

  test("a flick left at 0.45 px/ms over 24 px commits next", () => {
    expect(release(-24, -0.45, width, both)).toBe("next");
  });

  test("a flick shorter than 24 px cancels, however fast", () => {
    expect(release(-23, -2, width, both)).toBe("cancel");
  });
});
