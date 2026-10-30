import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

export interface SwipeOptions {
  layers(): { current: HTMLElement; next: HTMLElement | null; prev: HTMLElement | null } | null;
  can(): { prev: boolean; next: boolean };
  onTap(): void;
  onCommit(dir: "next" | "prev"): void; // after the animation finishes
  reducedMotion(): boolean;
  animate?: (el: Element, k: Keyframe[], o: KeyframeAnimationOptions) => Animation; // injectable
}

export function useSwipe(stage: RefObject<HTMLElement | null>, o: SwipeOptions): { commit(dir: "next" | "prev"): void } {
  const options = useRef(o);
  useLayoutEffect(() => {
    options.current = o;
  });

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const up = () => options.current.onTap();
    el.addEventListener("pointerup", up);
    return () => el.removeEventListener("pointerup", up);
  }, [stage]);

  return { commit() {} };
}
