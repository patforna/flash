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

describe("useShortcuts", () => {
  test("Space flips", () => {
    const { h } = setup();
    fireEvent.keyDown(document.body, { key: " " });
    expect(h.flip).toHaveBeenCalledOnce();
  });
});
