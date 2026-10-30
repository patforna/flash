import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FullscreenChip } from "./FullscreenChip";

// To do:
// [x] renders nothing where fullscreen isn't available
// [x] in a tab that can go fullscreen: a "Full screen" button with an icon hidden from assistive technology
// [ ] goes fullscreen when clicked
// [ ] hides once fullscreen and returns when fullscreen ends (fullscreenchange)
// [ ] hides when the display mode stops being a browser tab (the query's change event)

// happy-dom has no Fullscreen API: each test defines what it needs, removed afterwards.
const defined: [object, string][] = [];

function define(target: object, key: string, value: unknown) {
  Object.defineProperty(target, key, { configurable: true, value });
  defined.push([target, key]);
}

// A browser tab (happy-dom matches display-mode browser) that can go fullscreen.
function fullscreenTab() {
  const request = vi.fn(async () => {});
  define(document, "fullscreenEnabled", true);
  define(document, "fullscreenElement", null);
  define(document.documentElement, "requestFullscreen", request);
  return request;
}

afterEach(() => {
  for (const [target, key] of defined.splice(0)) Reflect.deleteProperty(target, key);
});

describe("FullscreenChip", () => {
  it("renders nothing where fullscreen isn't available", () => {
    const { container } = render(<FullscreenChip />, { reactStrictMode: true });

    expect(container.innerHTML).toBe("");
  });

  it("is a Full screen button, its icon hidden from assistive technology, in a tab that can go fullscreen", () => {
    fullscreenTab();

    render(<FullscreenChip />, { reactStrictMode: true });

    const button = screen.getByRole("button", { name: "Full screen" });
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
