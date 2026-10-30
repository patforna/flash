import { type RefObject, useLayoutEffect, useState } from "react";

export function chooseStep(fits: (step: number) => boolean, steps: number): number | "scroll" {
  for (let step = 0; step < steps; step++) {
    if (fits(step)) return step;
  }
  return "scroll";
}

// The faces' type: the handwriting, and Radon for code and the counter's digits.
const FONTS = ['1em "Shantell Sans"', '1em "Monaspace Radon"'];

// A face fits when none of its parts overflows its box, down or across (a code line wider than its column).
function overflows(face: HTMLElement): boolean {
  return Array.from(face.children).some(
    (part) => part.scrollHeight > part.clientHeight || part.scrollWidth > part.clientWidth,
  );
}

export function useFit(ref: RefObject<HTMLElement | null>, steps: number, _key: string): number | "scroll" {
  const [fit, setFit] = useState<number | "scroll">(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const measure = () => {
      if (!live) return;
      const step = chooseStep((s) => {
        el.dataset.fit = String(s);
        return !overflows(el);
      }, steps);
      el.dataset.fit = String(step);
      setFit(step);
    };
    if (FONTS.every((font) => document.fonts.check(font))) measure();
    else Promise.all(FONTS.map((font) => document.fonts.load(font))).then(measure, measure);
    return () => {
      live = false;
    };
  });
  return fit;
}
