// To do:
// [x] scrolls down by the amount when there is room below, and says so
// [x] scrolls up by the amount when there is room above
// [x] does nothing, and says so, at the end it is asked towards, or with nothing to scroll
// [x] smooth unless asked otherwise (reduced motion)
import { describe, expect, it, vi } from "vitest";
import { scrollBy } from "./scroll";

// A scroller as the DOM reports one: happy-dom lays nothing out.
function scroller({ top = 0, client = 100, height = 300 } = {}) {
  const el = { scrollTop: top, clientHeight: client, scrollHeight: height, scrollBy: vi.fn() };
  return el as unknown as HTMLElement & { scrollBy: ReturnType<typeof vi.fn> };
}

describe("scrollBy", () => {
  it("scrolls down by the amount while there is room below", () => {
    const el = scroller();
    expect(scrollBy(el, 1, 60, true)).toBe(true);
    expect(el.scrollBy).toHaveBeenCalledWith({ top: 60, behavior: "smooth" });
  });

  it("scrolls up by the amount while there is room above", () => {
    const el = scroller({ top: 150 });
    expect(scrollBy(el, -1, 60, false)).toBe(true);
    expect(el.scrollBy).toHaveBeenCalledWith({ top: -60, behavior: "auto" });
  });

  it("does nothing at the end it is asked towards, or with nothing to scroll", () => {
    expect(scrollBy(scroller({ top: 200 }), 1, 60, true)).toBe(false);
    expect(scrollBy(scroller({ top: 0 }), -1, 60, true)).toBe(false);
    expect(scrollBy(scroller({ height: 100 }), 1, 60, true)).toBe(false);
  });
});
