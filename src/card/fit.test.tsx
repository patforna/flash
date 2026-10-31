// To do:
// [x] chooseStep: step 0 (the largest type) when it fits
// [x] chooseStep: the first smaller step that fits
// [x] chooseStep: "scroll" when no step fits
// [x] useFit: with the fonts in, measures before paint (a later layout effect sees data-fit)
// [x] useFit: content hidden (no data-fit) until the fonts load; then measured
// [x] useFit: waits for the marker too (the question is written in it)
// [x] useFit: walks the steps while a part overflows down
// [x] useFit: a part overflowing across (a code line wider than its column) also steps down
// [x] useFit: a highlight's 2u of end padding hanging past the column is no overflow
// [x] useFit: "scroll" when no step fits
// [x] useFit: measures once per key, not on every render (a flip re-renders the card; measuring forces layout)
// [x] useFit: measures again when its key changes
// [x] useFit: a key measured before takes its step at once, with no measuring (a card remounts on every move)
import { configure, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chooseStep, useFit } from "./fit";

configure({ reactStrictMode: true });

// A step, once measured, holds for its key for the rest of the page load: each test measures under keys of its own.
let tests = 0;
beforeEach(() => {
  tests++;
});
const key = (name: string) => `${name}-${tests}`;

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
const ALL = ["Klee One", "Covered By Your Grace"];
function stubFonts(loaded: string[]) {
  const fonts = {
    check: vi.fn((font: string) => loaded.some((family) => font.includes(family))),
    load: vi.fn(() => Promise.resolve([])),
  };
  Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
  return fonts;
}

type Overflow = { until: number; axis: "down" | "across"; by?: number };

// happy-dom has no layout: the part overflows its box by `by` px (1 unless given), down or across, while its face is
// at a step below `until`. The face is 360 px tall, so a card unit is 1 px.
function overflowing({ until, axis, by = 1 }: Overflow) {
  return (part: HTMLElement | null) => {
    const face = part?.parentElement;
    if (!part || !face) return;
    Object.defineProperty(face, "clientHeight", { configurable: true, value: 360 });
    const [scroll, client] = axis === "down" ? ["scrollHeight", "clientHeight"] : ["scrollWidth", "clientWidth"];
    Object.defineProperty(part, client, { configurable: true, value: 100 });
    Object.defineProperty(part, scroll, {
      configurable: true,
      get: () => (Number(face.dataset.fit) < until ? 100 + by : 100),
    });
  };
}

type FaceProps = { fitKey: string; overflow?: Overflow; onLayout?: (fit: string | undefined) => void };

function Face({ fitKey, overflow, onLayout }: FaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFit(ref, 3, fitKey);
  useLayoutEffect(() => {
    onLayout?.(ref.current?.dataset.fit);
  });
  return (
    <div ref={ref} data-testid="face">
      <p ref={overflow && overflowing(overflow)}>How do you choose a shard key?</p>
    </div>
  );
}

describe("useFit", () => {
  beforeEach(() => {
    stubFonts(ALL);
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "fonts");
  });

  it("measures before paint once the fonts are in", () => {
    const seen: (string | undefined)[] = [];
    render(<Face fitKey={key("vacuum")} onLayout={(fit) => seen.push(fit)} />);
    expect(seen[0]).toBe("0");
  });

  it("keeps the content hidden until the fonts have loaded, then measures", async () => {
    const fonts = stubFonts([]);
    render(<Face fitKey={key("vacuum")} />);
    const face = screen.getByTestId("face");
    expect(face.dataset.fit).toBeUndefined();
    expect(fonts.load).toHaveBeenCalledWith(expect.stringContaining("Klee One"));
    await waitFor(() => expect(face.dataset.fit).toBe("0"));
  });

  it("waits for the marker too", async () => {
    const fonts = stubFonts(["Klee One"]);
    render(<Face fitKey={key("vacuum")} />);
    const face = screen.getByTestId("face");
    expect(face.dataset.fit).toBeUndefined();
    expect(fonts.load).toHaveBeenCalledWith(expect.stringContaining("Covered By Your Grace"));
    await waitFor(() => expect(face.dataset.fit).toBe("0"));
  });

  it("steps the type down while a part overflows its box", () => {
    render(<Face fitKey={key("shard")} overflow={{ until: 2, axis: "down" }} />);
    expect(screen.getByTestId("face").dataset.fit).toBe("2");
  });

  it("also steps down while a part overflows across, as a code line wider than its column does", () => {
    render(<Face fitKey={key("skip-locked")} overflow={{ until: 1, axis: "across", by: 3 }} />);
    expect(screen.getByTestId("face").dataset.fit).toBe("1");
  });

  it("lets a highlight hang its 2 units of padding past the column's edge: that is no overflow", () => {
    render(<Face fitKey={key("hash-ring")} overflow={{ until: 1, axis: "across", by: 2 }} />);
    expect(screen.getByTestId("face").dataset.fit).toBe("0");
  });

  it('falls back to "scroll" when even the smallest step overflows', () => {
    render(<Face fitKey={key("too-long")} overflow={{ until: 3, axis: "down" }} />);
    expect(screen.getByTestId("face").dataset.fit).toBe("scroll");
  });

  it("measures once per key, not on every render", () => {
    const fonts = stubFonts(ALL);
    const { rerender } = render(<Face fitKey={key("vacuum")} />);
    const checks = fonts.check.mock.calls.length;
    rerender(<Face fitKey={key("vacuum")} />);
    expect(fonts.check.mock.calls.length).toBe(checks);
  });

  it("takes the step a key was measured at before, at once: a card mounts again whenever it changes layers", () => {
    const first = render(<Face fitKey={key("shard")} overflow={{ until: 2, axis: "down" }} />);
    first.unmount();
    const fonts = stubFonts([]);
    const seen: (string | undefined)[] = [];
    render(<Face fitKey={key("shard")} onLayout={(fit) => seen.push(fit)} />);
    expect(seen[0]).toBe("2");
    expect(fonts.load).not.toHaveBeenCalled();
  });

  it("measures again when its key changes", () => {
    const { rerender } = render(<Face fitKey={key("vacuum")} />);
    rerender(<Face fitKey={key("shard")} overflow={{ until: 2, axis: "down" }} />);
    expect(screen.getByTestId("face").dataset.fit).toBe("2");
  });
});
