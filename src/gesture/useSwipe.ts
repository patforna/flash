import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { classify, GESTURE, isTap, type Sample } from "./gesture";

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
}

const sample = (e: PointerEvent): Sample => ({ t: e.timeStamp, x: e.clientX, y: e.clientY });
const tilt = (dx: number) => Math.min(GESTURE.tiltMax, Math.max(-GESTURE.tiltMax, dx * GESTURE.tiltPerPx));

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
      if (layers) gesture = { start: sample(e), axis: "pending", layers };
    };
    const move = (e: PointerEvent) => {
      if (!gesture) return;
      if (gesture.axis === "pending") gesture.axis = classify(gesture.start, sample(e));
      if (gesture.axis !== "horizontal") return;
      const dx = e.clientX - gesture.start.x;
      gesture.layers.current.style.transform = `translateX(${dx}px) rotate(${tilt(dx)}deg)`;
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
