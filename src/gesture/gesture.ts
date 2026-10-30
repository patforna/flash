// The gesture recogniser's maths (docs/plan.md §4): pure functions over pointer samples, in CSS px and ms.
export const GESTURE = {
  slop: 10,
  axisRatio: 1.2,
  tapMaxMs: 350,
  commitFraction: 0.28,
  flingVelocity: 0.45,
  flingMinDx: 24,
  velocityWindowMs: 80,
  tiltPerPx: 0.03,
  tiltMax: 7,
  rubberLimit: 80,
} as const;

export interface Sample {
  t: number;
  x: number;
  y: number;
}

const withinSlop = (a: Sample, b: Sample) => Math.hypot(b.x - a.x, b.y - a.y) < GESTURE.slop;

export function classify(start: Sample, now: Sample): "pending" | "horizontal" | "vertical" {
  if (withinSlop(start, now)) return "pending";
  return Math.abs(now.x - start.x) >= GESTURE.axisRatio * Math.abs(now.y - start.y) ? "horizontal" : "vertical";
}

export function isTap(start: Sample, end: Sample): boolean {
  return withinSlop(start, end) && end.t - start.t <= GESTURE.tapMaxMs;
}
