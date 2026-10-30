// To do:
// [x] says the pass is done and how to go again: "That's all 16." and "Tap or swipe to shuffle again."
// [x] draws the tick as an SVG path, hidden from assistive tech
// [ ] sits on the same frame and face as a card
import { configure, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EndCard } from "./EndCard";

configure({ reactStrictMode: true });

describe("EndCard", () => {
  it("says the pass is done and how to go again", () => {
    render(<EndCard total={16} />);
    expect(screen.getByText("That's all 16.")).toBeTruthy();
    expect(screen.getByText("Tap or swipe to shuffle again.")).toBeTruthy();
  });

  it("draws the tick as an SVG path, hidden from assistive tech", () => {
    const { container } = render(<EndCard total={16} />);
    const tick = container.querySelector("svg");
    expect(tick?.getAttribute("aria-hidden")).toBe("true");
    expect(tick?.querySelector("path")?.getAttribute("d")).toBeTruthy();
  });
});
