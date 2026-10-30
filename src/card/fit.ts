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

// The step each key was measured at. A card mounts again each time it moves between the stage's layers, and card units
// make its step the same at any size, so a face is measured once per page load: measuring forces layout after layout,
// and a commit landing under a thumb remounts three cards.
const measured = new Map<string, number | "scroll">();

// Sets data-fit on the face to the largest type step at which nothing overflows ("scroll" if none fits), measured
// before paint once the fonts are in; the CSS sizes the type from data-fit and hides the content until it is set.
// Returns the step; measures again only when the key changes, and not at all for a key measured before.
export function useFit(ref: RefObject<HTMLElement | null>, steps: number, key: string): number | "scroll" {
  const [fit, setFit] = useState<number | "scroll">(() => measured.get(key) ?? 0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const known = measured.get(key);
    if (known !== undefined) {
      el.dataset.fit = String(known);
      setFit(known);
      return;
    }
    let live = true;
    const measure = () => {
      if (!live) return;
      const step = chooseStep((s) => {
        el.dataset.fit = String(s);
        return !overflows(el);
      }, steps);
      el.dataset.fit = String(step);
      measured.set(key, step);
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
