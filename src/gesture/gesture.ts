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

export function classify(start: Sample, now: Sample): "pending" | "horizontal" | "vertical" {
  const dx = now.x - start.x;
  const dy = now.y - start.y;
  if (Math.hypot(dx, dy) < GESTURE.slop) return "pending";
  return Math.abs(dx) >= GESTURE.axisRatio * Math.abs(dy) ? "horizontal" : "vertical";
}
