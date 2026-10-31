// To do:
// [x] carries data-revealed while revealed, not otherwise
// [x] says when the focus comes in, and when it leaves for outside; not when it moves between the controls
import { configure, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Controls } from "./Controls";

configure({ reactStrictMode: true });

function renderControls(revealed: boolean, onFocusWithin = vi.fn()) {
  const view = render(
    <>
      <Controls revealed={revealed} onFocusWithin={onFocusWithin}>
        <button type="button">one</button>
        <button type="button">two</button>
      </Controls>
      <button type="button">outside</button>
    </>,
  );
  const [one, two, outside] = Array.from(view.container.querySelectorAll("button"));
  return { onFocusWithin, group: view.container.firstElementChild as HTMLElement, one, two, outside };
}

describe("Controls", () => {
  it("carries data-revealed while revealed, and not otherwise", () => {
    expect(renderControls(true).group.hasAttribute("data-revealed")).toBe(true);
    expect(renderControls(false).group.hasAttribute("data-revealed")).toBe(false);
  });

  it("says when the focus comes in and when it leaves, not when it moves between the controls", () => {
    const { onFocusWithin, one, two, outside } = renderControls(false);
    if (!one || !two || !outside) throw new Error("three buttons");

    fireEvent.focus(one);
    expect(onFocusWithin.mock.calls).toEqual([[true]]);

    fireEvent.blur(one, { relatedTarget: two });
    fireEvent.focus(two);
    expect(onFocusWithin.mock.calls).toEqual([[true], [true]]);

    fireEvent.blur(two, { relatedTarget: outside });
    expect(onFocusWithin.mock.calls).toEqual([[true], [true], [false]]);
  });
});
