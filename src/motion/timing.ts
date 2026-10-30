// The Web Animations timings (docs/plan.md §4). The flip is a CSS transition; its tokens are in styles/tokens.css.
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// The fling's easing starts at up to 3.5 times its average speed, so 3.5·d/v carries the release speed on.
export function flingDuration(remainingPx: number, vPxPerMs: number): number {
  return clamp((3.5 * remainingPx) / Math.max(Math.abs(vPxPerMs), 0.6), 180, 320);
}
