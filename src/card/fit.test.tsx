// To do:
// [x] chooseStep: step 0 (the largest type) when it fits
// [x] chooseStep: the first smaller step that fits
// [x] chooseStep: "scroll" when no step fits
// [ ] useFit: with the fonts in, measures before paint (a later layout effect sees data-fit)
// [ ] useFit: content hidden (no data-fit) until the fonts load; then measured
// [ ] useFit: walks the steps while a part overflows down
// [ ] useFit: a part overflowing across (a code line wider than its column) also steps down
// [ ] useFit: "scroll" when no step fits
// [ ] useFit: measures again when its key changes
import { render } from "@testing-library/react";
import { useLayoutEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chooseStep, useFit } from "./fit";

describe("chooseStep", () => {
  it("chooses step 0, the largest type, when it fits", () => {
    expect(chooseStep(() => true, 3)).toBe(0);
  });

  it("chooses the first smaller step that fits", () => {
    expect(chooseStep((step) => step >= 2, 3)).toBe(2);
  });

  it('gives "scroll" when no step fits', () => {
    expect(chooseStep(() => false, 3)).toBe("scroll");
  });
});

// happy-dom has no document.fonts: stand one in whose faces are either in already or arrive when load() resolves.
function stubFonts(ready: boolean) {
  const fonts = { check: vi.fn(() => ready), load: vi.fn(() => Promise.resolve([])) };
  Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
  return fonts;
}

function Face({ fitKey, onLayout }: { fitKey: string; onLayout?: (fit: string | undefined) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFit(ref, 3, fitKey);
  useLayoutEffect(() => {
    onLayout?.(ref.current?.dataset.fit);
  });
  return (
    <div ref={ref} data-testid="face">
      <p>Why does Postgres need VACUUM?</p>
    </div>
  );
}

describe("useFit", () => {
  beforeEach(() => {
    stubFonts(true);
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "fonts");
  });

  it("measures before paint once the fonts are in", () => {
    const seen: (string | undefined)[] = [];
    render(<Face fitKey="vacuum" onLayout={(fit) => seen.push(fit)} />);
    expect(seen[0]).toBe("0");
  });
});
