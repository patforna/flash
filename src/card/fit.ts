import { type RefObject, useLayoutEffect } from "react";

export function chooseStep(fits: (step: number) => boolean, steps: number): number | "scroll" {
  for (let step = 0; step < steps; step++) {
    if (fits(step)) return step;
  }
  return "scroll";
}

const HAND = '1em "Shantell Sans"';

export function useFit(ref: RefObject<HTMLElement | null>, _steps: number, _key: string): number | "scroll" {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const measure = () => {
      if (live) el.dataset.fit = "0";
    };
    if (document.fonts.check(HAND)) measure();
    else document.fonts.load(HAND).then(measure, measure);
    return () => {
      live = false;
    };
  });
  return 0;
}
