// The Web Animations timings (docs/plan.md §4). The flip is a CSS transition; its tokens are in styles/tokens.css.
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// The fling's easing starts at up to 3.5 times its average speed, so 3.5·d/v carries the release speed on.
export function flingDuration(remainingPx: number, vPxPerMs: number): number {
  return clamp((3.5 * remainingPx) / Math.max(Math.abs(vPxPerMs), 0.6), 180, 320);
}

// The fling's curve for one release: its initial slope y1/0.2 makes the card leave at the release speed, even when
// the duration is clamped; gentle at least (0.1), at most the 3.5 that flingDuration assumes (0.7).
export function flingEasing(remainingPx: number, vPxPerMs: number): string {
  const duration = flingDuration(remainingPx, vPxPerMs);
  const y1 = clamp((0.2 * Math.abs(vPxPerMs) * duration) / remainingPx, 0.1, 0.7);
  return `cubic-bezier(0.2, ${y1}, 0.3, 1)`;
}
