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

export function velocityX(samples: readonly Sample[]): number {
  const end = samples.at(-1)?.t ?? 0;
  const recent = samples.filter((s) => s.t >= end - GESTURE.velocityWindowMs);
  const n = recent.length;
  const meanT = recent.reduce((sum, s) => sum + s.t, 0) / n;
  const meanX = recent.reduce((sum, s) => sum + s.x, 0) / n;
  let covariance = 0;
  let variance = 0;
  for (const s of recent) {
    covariance += (s.t - meanT) * (s.x - meanX);
    variance += (s.t - meanT) ** 2;
  }
  return variance === 0 ? 0 : covariance / variance;
}

export function release(
  dx: number,
  vx: number,
  width: number,
  can: { prev: boolean; next: boolean },
): "next" | "prev" | "cancel" {
  const distance = Math.abs(dx);
  const speed = Math.sign(dx) * vx; // along the drag; negative when flung back
  const far = distance / width >= GESTURE.commitFraction;
  const flung = speed >= GESTURE.flingVelocity && distance >= GESTURE.flingMinDx;
  const flungBack = -speed >= GESTURE.flingVelocity;
  const dir = dx < 0 ? "next" : "prev";
  return (far || flung) && !flungBack && can[dir] ? dir : "cancel";
}
