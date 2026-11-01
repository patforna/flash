// To do:
// [x] Space, Enter, j and k flip; ↓ and ↑ are down and up (the stage scrolls a long back by them, or flips); →, l and
//     PageDown next; ←, h and PageUp previous; s reshuffles; f fullscreen; t topics
// [x] in the topic drawer (a dialog) only t fires
// [x] a handled key doesn't scroll
// [x] nothing fires with Alt, Ctrl or Meta, while typing (input, textarea, contenteditable), or on auto-repeat
// [x] Space and Enter are left to a focused button; other keys still work there
// [x] the latest handlers are called; the listener goes on unmount
import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useShortcuts } from "./useShortcuts";

function setup() {
  const h = {
    flip: vi.fn(),
    down: vi.fn(),
    up: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    reshuffle: vi.fn(),
    fullscreen: vi.fn(),
    topics: vi.fn(),
  };
  const view = renderHook(() => useShortcuts(h));
  return { h, ...view };
}

type Action = keyof ReturnType<typeof setup>["h"];

describe("useShortcuts", () => {
  test.each<[string, Action]>([
    [" ", "flip"],
    ["Enter", "flip"],
    ["ArrowUp", "up"],
    ["ArrowDown", "down"],
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
    ["t", "topics"],
  ])("%j: %s", (key, action) => {
    const { h } = setup();
    fireEvent.keyDown(document.body, { key });
    for (const [name, handler] of Object.entries(h)) {
      expect(handler).toHaveBeenCalledTimes(name === action ? 1 : 0);
    }
  });

  test("in the topic drawer only t fires: the cards are under a scrim", () => {
    const { h } = setup();
    document.body.innerHTML = '<aside role="dialog"><button type="button">Redis</button></aside>';
    const row = document.querySelector("button") as HTMLElement;
    for (const key of ["l", "h", "j", "s", "f", "ArrowRight"]) fireEvent.keyDown(row, { key });
    expect(Object.values(h).some((handler) => handler.mock.calls.length > 0)).toBe(false);

    fireEvent.keyDown(row, { key: "t" });
    expect(h.topics).toHaveBeenCalledTimes(1);
    document.body.innerHTML = "";
  });

  test("any other key does nothing", () => {
    const { h } = setup();
    fireEvent.keyDown(document.body, { key: "x" });
    for (const handler of Object.values(h)) expect(handler).not.toHaveBeenCalled();
  });

  test("a handled key doesn't scroll the page; any other key keeps its default", () => {
    setup();
    expect(fireEvent.keyDown(document.body, { key: "PageDown" })).toBe(false);
    expect(fireEvent.keyDown(document.body, { key: "x" })).toBe(true);
  });

  test.each(["altKey", "ctrlKey", "metaKey"])(
    "nothing fires with %s held, and the browser keeps the key",
    (modifier) => {
      const { h } = setup();
      expect(fireEvent.keyDown(document.body, { key: "l", [modifier]: true })).toBe(true);
      expect(h.next).not.toHaveBeenCalled();
    },
  );

  test("nothing fires on auto-repeat", () => {
    const { h } = setup();
    fireEvent.keyDown(document.body, { key: "ArrowRight", repeat: true });
    expect(h.next).not.toHaveBeenCalled();
  });

  test.each([
    ["an input", "input"],
    ["a textarea", "textarea"],
    ["a contenteditable", "div"],
  ])("nothing fires while typing in %s", (_, tag) => {
    const { h } = setup();
    const field = document.createElement(tag);
    if (tag === "div") field.setAttribute("contenteditable", "");
    document.body.append(field);
    fireEvent.keyDown(field, { key: "s" });
    expect(h.reshuffle).not.toHaveBeenCalled();
    field.remove();
  });

  test("Space and Enter are left to a focused button; other keys still work there", () => {
    const { h } = setup();
    const button = document.createElement("button");
    document.body.append(button);
    expect(fireEvent.keyDown(button, { key: " " })).toBe(true);
    fireEvent.keyDown(button, { key: "Enter" });
    expect(h.flip).not.toHaveBeenCalled();
    fireEvent.keyDown(button, { key: "ArrowRight" });
    expect(h.next).toHaveBeenCalledOnce();
    button.remove();
  });

  test("calls the latest render's handlers and stops listening on unmount", () => {
    const handlers = () => ({
      flip: vi.fn(),
      down: vi.fn(),
      up: vi.fn(),
      next: vi.fn(),
      prev: vi.fn(),
      reshuffle: vi.fn(),
      fullscreen: vi.fn(),
      topics: vi.fn(),
    });
    const first = handlers();
    const second = handlers();
    const { rerender, unmount } = renderHook((h) => useShortcuts(h), { initialProps: first });
    rerender(second);
    fireEvent.keyDown(document.body, { key: "s" });
    expect(first.reshuffle).not.toHaveBeenCalled();
    expect(second.reshuffle).toHaveBeenCalledOnce();
    unmount();
    fireEvent.keyDown(document.body, { key: "s" });
    expect(second.reshuffle).toHaveBeenCalledOnce();
  });
});
