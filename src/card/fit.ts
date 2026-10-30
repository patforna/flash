import { type RefObject, useLayoutEffect, useState } from "react";

export function chooseStep(fits: (step: number) => boolean, steps: number): number | "scroll" {
  for (let step = 0; step < steps; step++) {
    if (fits(step)) return step;
  }
  return "scroll";
}

// The faces' type: the handwriting, and Radon for code and the counter's digits.
export const FONTS = ['1em "Shantell Sans"', '1em "Monaspace Radon"'];

// A face fits when none of its parts overflows its box, down or across (a code line wider than its column). A
// highlighter stroke may end at the column's edge with its 2 units of padding past it (card.module.css): no overflow.
function overflows(face: HTMLElement): boolean {
  const overhang = Math.ceil((2 * face.clientHeight) / 360);
  return Array.from(face.children).some(
    (part) => part.scrollHeight > part.clientHeight || part.scrollWidth > part.clientWidth + overhang,
  );
}

// Sets data-fit on the face to the largest type step at which nothing overflows ("scroll" if none fits), measured
// before paint once the fonts are in; the CSS sizes the type from data-fit and hides the content until it is set.
// Returns the step; measures again only when the key changes.
export function useFit(ref: RefObject<HTMLElement | null>, steps: number, key: string): number | "scroll" {
  const [fit, setFit] = useState<number | "scroll">(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key names the content; measure again only when it changes.
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
  }, [ref, steps, key]);
  return fit;
}
