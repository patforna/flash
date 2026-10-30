import { type RefObject, useLayoutEffect } from "react";

export function chooseStep(fits: (step: number) => boolean, steps: number): number | "scroll" {
  for (let step = 0; step < steps; step++) {
    if (fits(step)) return step;
  }
  return "scroll";
}

export function useFit(ref: RefObject<HTMLElement | null>, _steps: number, _key: string): number | "scroll" {
  useLayoutEffect(() => {
    if (ref.current) ref.current.dataset.fit = "0";
  });
  return 0;
}
