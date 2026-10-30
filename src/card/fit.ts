export function chooseStep(fits: (step: number) => boolean, steps: number): number | "scroll" {
  for (let step = 0; step < steps; step++) {
    if (fits(step)) return step;
  }
  return 0;
}
