import { type RefObject, useLayoutEffect } from "react";

export function chooseStep(fits: (step: number) => boolean, steps: number): number | "scroll" {
  for (let step = 0; step < steps; step++) {
    if (fits(step)) return step;
  }
  return "scroll";
}

// The faces' type: the handwriting, and Radon for code and the counter's digits.
const FONTS = ['1em "Shantell Sans"', '1em "Monaspace Radon"'];

export function useFit(ref: RefObject<HTMLElement | null>, _steps: number, _key: string): number | "scroll" {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const measure = () => {
      if (live) el.dataset.fit = "0";
    };
    if (FONTS.every((font) => document.fonts.check(font))) measure();
    else Promise.all(FONTS.map((font) => document.fonts.load(font))).then(measure, measure);
    return () => {
      live = false;
    };
  });
  return 0;
}
