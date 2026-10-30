// To do:
// [x] chooseStep: step 0 (the largest type) when it fits
// [x] chooseStep: the first smaller step that fits
// [x] chooseStep: "scroll" when no step fits
// [x] useFit: with the fonts in, measures before paint (a later layout effect sees data-fit)
// [x] useFit: content hidden (no data-fit) until the fonts load; then measured
// [x] useFit: waits for the code font too (code blocks and the counter are set in it)
// [ ] useFit: walks the steps while a part overflows down
// [ ] useFit: a part overflowing across (a code line wider than its column) also steps down
// [ ] useFit: "scroll" when no step fits
// [ ] useFit: measures again when its key changes
import { render, screen, waitFor } from "@testing-library/react";
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

// happy-dom has no document.fonts: stand one in where the named families are in already and the rest arrive when
// load() resolves.
const BOTH = ["Shantell Sans", "Monaspace Radon"];
function stubFonts(loaded: string[]) {
  const fonts = {
    check: vi.fn((font: string) => loaded.some((family) => font.includes(family))),
    load: vi.fn(() => Promise.resolve([])),
  };
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
    stubFonts(BOTH);
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "fonts");
  });

  it("measures before paint once the fonts are in", () => {
    const seen: (string | undefined)[] = [];
    render(<Face fitKey="vacuum" onLayout={(fit) => seen.push(fit)} />);
    expect(seen[0]).toBe("0");
  });

  it("keeps the content hidden until the fonts have loaded, then measures", async () => {
    const fonts = stubFonts([]);
    render(<Face fitKey="vacuum" />);
    const face = screen.getByTestId("face");
    expect(face.dataset.fit).toBeUndefined();
    expect(fonts.load).toHaveBeenCalledWith(expect.stringContaining("Shantell Sans"));
    await waitFor(() => expect(face.dataset.fit).toBe("0"));
  });

  it("waits for the code font too", async () => {
    const fonts = stubFonts(["Shantell Sans"]);
    render(<Face fitKey="vacuum" />);
    const face = screen.getByTestId("face");
    expect(face.dataset.fit).toBeUndefined();
    expect(fonts.load).toHaveBeenCalledWith(expect.stringContaining("Monaspace Radon"));
    await waitFor(() => expect(face.dataset.fit).toBe("0"));
  });
});
