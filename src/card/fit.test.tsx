// To do:
// [x] chooseStep: step 0 (the largest type) when it fits
// [x] chooseStep: the first smaller step that fits
// [x] chooseStep: "scroll" when no step fits
// [x] useFit: with the fonts in, measures before paint (a later layout effect sees data-fit)
// [x] useFit: content hidden (no data-fit) until the fonts load; then measured
// [x] useFit: waits for the code font too (code blocks and the counter are set in it)
// [x] useFit: walks the steps while a part overflows down
// [x] useFit: a part overflowing across (a code line wider than its column) also steps down
// [x] useFit: "scroll" when no step fits
// [x] useFit: measures once per key, not on every render (a flip re-renders the card; measuring forces layout)
// [x] useFit: measures again when its key changes
import { configure, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chooseStep, useFit } from "./fit";

configure({ reactStrictMode: true });

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

type Overflow = { until: number; axis: "down" | "across" };

// happy-dom has no layout: the part overflows its box, down or across, while its face is at a step below `until`.
function overflowing({ until, axis }: Overflow) {
  return (part: HTMLElement | null) => {
    const face = part?.parentElement;
    if (!part || !face) return;
    const [scroll, client] = axis === "down" ? ["scrollHeight", "clientHeight"] : ["scrollWidth", "clientWidth"];
    Object.defineProperty(part, client, { configurable: true, value: 100 });
    Object.defineProperty(part, scroll, {
      configurable: true,
      get: () => (Number(face.dataset.fit) < until ? 101 : 100),
    });
  };
}

type FaceProps = { fitKey: string; overflow?: Overflow; onLayout?: (fit: string | undefined) => void };

function Face({ fitKey, overflow, onLayout }: FaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const step = useFit(ref, 3, fitKey);
  useLayoutEffect(() => {
    onLayout?.(ref.current?.dataset.fit);
  });
  return (
    <div ref={ref} data-testid="face" data-step={step}>
      <p ref={overflow && overflowing(overflow)}>How do you choose a shard key?</p>
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

  it("steps the type down while a part overflows its box", () => {
    render(<Face fitKey="shard" overflow={{ until: 2, axis: "down" }} />);
    const face = screen.getByTestId("face");
    expect(face.dataset.fit).toBe("2");
    expect(face.dataset.step).toBe("2");
  });

  it("also steps down while a part overflows across, as a code line wider than its column does", () => {
    render(<Face fitKey="skip-locked" overflow={{ until: 1, axis: "across" }} />);
    expect(screen.getByTestId("face").dataset.fit).toBe("1");
  });

  it('falls back to "scroll" when even the smallest step overflows', () => {
    render(<Face fitKey="too-long" overflow={{ until: 3, axis: "down" }} />);
    const face = screen.getByTestId("face");
    expect(face.dataset.fit).toBe("scroll");
    expect(face.dataset.step).toBe("scroll");
  });

  it("measures once per key, not on every render", () => {
    const fonts = stubFonts(BOTH);
    const { rerender } = render(<Face fitKey="vacuum" />);
    const checks = fonts.check.mock.calls.length;
    rerender(<Face fitKey="vacuum" />);
    expect(fonts.check.mock.calls.length).toBe(checks);
  });

  it("measures again when its key changes", () => {
    const { rerender } = render(<Face fitKey="vacuum" />);
    rerender(<Face fitKey="shard" overflow={{ until: 2, axis: "down" }} />);
    const face = screen.getByTestId("face");
    expect(face.dataset.fit).toBe("2");
    expect(face.dataset.step).toBe("2");
  });
});
