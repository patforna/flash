import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FullscreenChip } from "./FullscreenChip";

// To do:
// [x] renders nothing where fullscreen isn't available
// [x] in a tab that can go fullscreen: a "Full screen" button with an icon hidden from assistive technology
// [x] goes fullscreen when clicked
// [x] hides once fullscreen and returns when fullscreen ends (fullscreenchange)
// [x] hides when the display mode stops being a browser tab (the query's change event)

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

// What the browser does on entering or leaving fullscreen.
function fullscreenChange(element: Element | null) {
  define(document, "fullscreenElement", element);
  act(() => {
    document.dispatchEvent(new Event("fullscreenchange"));
  });
}

// happy-dom's (display-mode: browser) never changes; this one does, and tells its listeners as a MediaQueryList does.
function displayModeQuery() {
  const query = Object.assign(new EventTarget(), { matches: true });
  vi.stubGlobal("matchMedia", () => query);
  return (browser: boolean) => {
    query.matches = browser;
    act(() => {
      query.dispatchEvent(new Event("change"));
    });
  };
}

afterEach(() => {
  for (const [target, key] of defined.splice(0)) Reflect.deleteProperty(target, key);
  vi.unstubAllGlobals();
});

function renderChip() {
  return render(<FullscreenChip />, { reactStrictMode: true });
}

function chip() {
  return screen.queryByRole("button", { name: "Full screen" });
}

describe("FullscreenChip", () => {
  it("renders nothing where fullscreen isn't available", () => {
    const { container } = renderChip();

    expect(container.innerHTML).toBe("");
  });

  it("is a Full screen button, its icon hidden from assistive technology, in a tab that can go fullscreen", () => {
    fullscreenTab();

    renderChip();

    const button = screen.getByRole("button", { name: "Full screen" });
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("goes fullscreen when clicked", () => {
    const request = fullscreenTab();
    renderChip();

    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));

    expect(request).toHaveBeenCalledWith({ navigationUI: "hide" });
  });

  it("hides once fullscreen and returns when fullscreen ends", () => {
    fullscreenTab();
    renderChip();

    fullscreenChange(document.documentElement);
    expect(chip()).toBeNull();

    fullscreenChange(null);
    expect(chip()).not.toBeNull();
  });

  it("hides when the display mode stops being a browser tab", () => {
    fullscreenTab();
    const setBrowser = displayModeQuery();
    renderChip();

    setBrowser(false);

    expect(chip()).toBeNull();
  });
});
