import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { classify, GESTURE, isTap, rubberBand, type Sample } from "./gesture";

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
  axis: "pending" | "horizontal" | "vertical";
  layers: Layers;
  rect: DOMRect; // the current card at pointerdown, in viewport px
}

// How far past the screen's left edge a card rests once it has gone, and where the previous card comes back from.
const OFF_SCREEN = 80;

const sample = (e: PointerEvent): Sample => ({ t: e.timeStamp, x: e.clientX, y: e.clientY });
const tilt = (dx: number) => Math.min(GESTURE.tiltMax, Math.max(-GESTURE.tiltMax, dx * GESTURE.tiltPerPx));
const fixed = (n: number) => Math.round(n * 1e4) / 1e4;
// The card underneath, from resting (p = 0) to in place (p = 1).
const underneath = (p: number) => `scale(${fixed(0.965 + 0.035 * p)}) translateY(${fixed(8 * (1 - p))}px)`;

export function useSwipe(stage: RefObject<HTMLElement | null>, o: SwipeOptions): { commit(dir: "next" | "prev"): void } {
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
      if (layers) gesture = { start: sample(e), axis: "pending", layers, rect: layers.current.getBoundingClientRect() };
    };
    const move = (e: PointerEvent) => {
      if (!gesture) return;
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
      if (gesture?.axis === "pending" && isTap(gesture.start, sample(e))) options.current.onTap();
      gesture = null;
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
