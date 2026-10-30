// To do:
// [ ] Space, Enter, ↑, ↓, j and k flip; →, l and PageDown next; ←, h and PageUp previous; s reshuffles; f fullscreen
// [ ] a handled key doesn't scroll
// [ ] nothing fires with Alt, Ctrl or Meta, while typing (input, textarea, contenteditable), or on auto-repeat
// [ ] Space and Enter are left to a focused button; other keys still work there
// [ ] the latest handlers are called; the listener goes on unmount
import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useShortcuts } from "./useShortcuts";

function setup() {
  const h = { flip: vi.fn(), next: vi.fn(), prev: vi.fn(), reshuffle: vi.fn(), fullscreen: vi.fn() };
  const view = renderHook(() => useShortcuts(h));
  return { h, ...view };
}

type Action = keyof ReturnType<typeof setup>["h"];

describe("useShortcuts", () => {
  test.each<[string, Action]>([
    [" ", "flip"],
    ["Enter", "flip"],
    ["ArrowUp", "flip"],
    ["ArrowDown", "flip"],
    ["j", "flip"],
    ["k", "flip"],
    ["ArrowRight", "next"],
    ["l", "next"],
    ["PageDown", "next"],
    ["ArrowLeft", "prev"],
    ["h", "prev"],
    ["PageUp", "prev"],
    ["s", "reshuffle"],
    ["f", "fullscreen"],
  ])("%j: %s", (key, action) => {
    const { h } = setup();
    fireEvent.keyDown(document.body, { key });
    for (const [name, handler] of Object.entries(h)) {
      expect(handler).toHaveBeenCalledTimes(name === action ? 1 : 0);
    }
  });

  test("any other key does nothing", () => {
    const { h } = setup();
    fireEvent.keyDown(document.body, { key: "x" });
    for (const handler of Object.values(h)) expect(handler).not.toHaveBeenCalled();
  });
});
