// To do:
// [ ] chooseStep: step 0 (the largest type) when it fits
// [ ] chooseStep: the first smaller step that fits
// [ ] chooseStep: "scroll" when no step fits
// [ ] useFit: content hidden until measured
// [ ] useFit: measures at once when document.fonts.check() passes
// [ ] useFit: otherwise measures after document.fonts.load() resolves
// [ ] useFit: walks the steps, overflow vertical or horizontal
// [ ] useFit: measures again when its key changes
import { describe, expect, it } from "vitest";
import { chooseStep } from "./fit";

describe("chooseStep", () => {
  it("chooses step 0, the largest type, when it fits", () => {
    expect(chooseStep(() => true, 3)).toBe(0);
  });
});
