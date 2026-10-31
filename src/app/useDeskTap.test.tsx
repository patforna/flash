// To do:
// [x] a quick, still touch on the desk is a tap
// [x] not one that starts on a card, a button or the drawer
// [x] not one that moves past the slop, takes longer than a tap, or is cancelled
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDeskTap } from "./useDeskTap";

// happy-dom's PointerEvent ignores timeStamp in its init: set it on the event.
function pointer(type: string, target: Element, x: number, y: number, t: number) {
  const e = new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, isPrimary: true, pointerId: 1 });
  Object.defineProperty(e, "timeStamp", { value: t });
  target.dispatchEvent(e);
}

function setup(html = "") {
  document.body.innerHTML = `${html}<div id="desk"></div>`;
  const onTap = vi.fn();
  renderHook(() => useDeskTap(onTap));
  const at = (selector: string) => document.querySelector(selector) as Element;
  return { onTap, at };
}

describe("useDeskTap", () => {
  it("takes a quick, still touch on the desk as a tap", () => {
    const { onTap, at } = setup();
    pointer("pointerdown", at("#desk"), 100, 100, 1000);
    pointer("pointerup", at("#desk"), 104, 103, 1200);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['<div data-role="current"><p id="on">card</p></div>', "#on"],
    ['<button id="on" type="button">chip</button>', "#on"],
    ['<aside role="dialog"><p id="on">list</p></aside>', "#on"],
  ])("ignores a touch starting on %s", (html, selector) => {
    const { onTap, at } = setup(html);
    pointer("pointerdown", at(selector), 100, 100, 1000);
    pointer("pointerup", at(selector), 100, 100, 1100);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("ignores a touch that moves past the slop, takes too long, or is cancelled", () => {
    const { onTap, at } = setup();
    pointer("pointerdown", at("#desk"), 100, 100, 1000);
    pointer("pointerup", at("#desk"), 120, 100, 1100);
    pointer("pointerdown", at("#desk"), 100, 100, 2000);
    pointer("pointerup", at("#desk"), 100, 100, 2400);
    pointer("pointerdown", at("#desk"), 100, 100, 3000);
    pointer("pointercancel", at("#desk"), 100, 100, 3050);
    pointer("pointerup", at("#desk"), 100, 100, 3100);
    expect(onTap).not.toHaveBeenCalled();
  });
});
