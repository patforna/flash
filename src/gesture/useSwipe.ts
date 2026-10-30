import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { flingDuration, flingEasing } from "../motion/timing";
import { classify, GESTURE, isTap, release, rubberBand, type Sample, velocityX } from "./gesture";

export interface SwipeOptions {
  layers(): { current: HTMLElement; next: HTMLElement | null; prev: HTMLElement | null } | null;
  can(): { prev: boolean; next: boolean };
  onTap(): void;
  onCommit(dir: "next" | "prev"): void; // after the animation finishes
  reducedMotion(): boolean;
  animate?: (el: Element, k: Keyframe[], o: KeyframeAnimationOptions) => Animation; // injectable
}

type Layers = NonNullable<ReturnType<SwipeOptions["layers"]>>;

interface Gesture {
  start: Sample;
  samples: Sample[];
  axis: "pending" | "horizontal" | "vertical";
  layers: Layers;
  rect: DOMRect; // the current card at pointerdown, in viewport px
}

// How far past the screen's left edge a card rests once it has gone, and where the previous card comes back from.
const OFF_SCREEN = 80;

const sample = (e: PointerEvent): Sample => ({ t: e.timeStamp, x: e.clientX, y: e.clientY });
const tilt = (dx: number) => Math.min(GESTURE.tiltMax, Math.max(-GESTURE.tiltMax, dx * GESTURE.tiltPerPx));
const fixed = (n: number) => Math.round(n * 1e4) / 1e4;
const FLING_TILT = 10; // degrees, as a flung card leaves
// The card underneath, from resting (p = 0) to in place (p = 1).
const underneath = (p: number) => `scale(${fixed(0.965 + 0.035 * p)}) translateY(${fixed(8 * (1 - p))}px)`;

export function useSwipe(
  stage: RefObject<HTMLElement | null>,
  o: SwipeOptions,
): { commit(dir: "next" | "prev"): void } {
  const options = useRef(o);
  useLayoutEffect(() => {
    options.current = o;
  });

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let gesture: Gesture | null = null;

    const down = (e: PointerEvent) => {
      const layers = options.current.layers();
      if (!layers) return;
      const start = sample(e);
      gesture = { start, samples: [start], axis: "pending", layers, rect: layers.current.getBoundingClientRect() };
    };
    const move = (e: PointerEvent) => {
      if (!gesture) return;
      gesture.samples.push(sample(e));
      if (gesture.axis === "pending") gesture.axis = classify(gesture.start, sample(e));
      if (gesture.axis !== "horizontal") return;
      const { layers, rect } = gesture;
      const dx = e.clientX - gesture.start.x;
      if (dx > 0 && layers.prev) {
        layers.prev.style.visibility = "visible";
        layers.prev.style.transform = `translateX(${dx - rect.right - OFF_SCREEN}px)`;
        return;
      }
      const x = dx > 0 ? rubberBand(dx) : dx;
      layers.current.style.transform = `translateX(${fixed(x)}px) rotate(${fixed(tilt(x))}deg)`;
      if (layers.next && dx < 0) {
        layers.next.style.transform = underneath(Math.min(-dx / rect.width / GESTURE.commitFraction, 1));
      }
    };
    const up = (e: PointerEvent) => {
      const g = gesture;
      gesture = null;
      if (g?.axis === "pending" && isTap(g.start, sample(e))) options.current.onTap();
      if (g?.axis !== "horizontal") return;
      g.samples.push(sample(e));
      const dx = e.clientX - g.start.x;
      const vx = velocityX(g.samples);
      if (release(dx, vx, g.rect.width, options.current.can()) !== "next") return;
      const animate = options.current.animate ?? ((target, k, o) => target.animate(k, o));
      const { current, next } = g.layers;
      const gone = -(g.rect.right + OFF_SCREEN);
      const timing = { duration: flingDuration(dx - gone, vx), easing: flingEasing(dx - gone, vx) };
      animate(
        current,
        [{ transform: current.style.transform }, { transform: `translateX(${gone}px) rotate(${-FLING_TILT}deg)` }],
        {
          ...timing,
          fill: "forwards",
        },
      );
      if (next) {
        const from = next.style.transform;
        next.style.transform = underneath(1);
        animate(next, [{ transform: from }, { transform: underneath(1) }], timing);
      }
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
  }, [stage]);

  return { commit() {} };
}
