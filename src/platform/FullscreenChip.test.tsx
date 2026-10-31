import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FullscreenChip } from "./FullscreenChip";

// To do:
// [x] renders nothing where fullscreen isn't available
// [x] in a tab that can go fullscreen: a "Full screen" button with an icon hidden from assistive technology
// [x] goes fullscreen when clicked
// [x] once fullscreen it is the way out: "Exit full screen", which leaves fullscreen when clicked
// [x] back to "Full screen" when fullscreen ends (fullscreenchange)
// [x] nothing once the display mode stops being a browser tab (the installed app)
// [x] pushed in (data-pressed) from a pointer going down on it until it goes up, is cancelled or leaves, as a sticker is

// happy-dom has no Fullscreen API: each test defines what it needs, removed afterwards.
const defined: [object, string][] = [];

function define(target: object, key: string, value: unknown) {
  Object.defineProperty(target, key, { configurable: true, value });
  defined.push([target, key]);
}

// A browser tab (happy-dom matches display-mode browser) that can go fullscreen.
function fullscreenTab() {
  const api = { request: vi.fn(async () => {}), exit: vi.fn(async () => {}) };
  define(document, "fullscreenEnabled", true);
  define(document, "fullscreenElement", null);
  define(document.documentElement, "requestFullscreen", api.request);
  define(document, "exitFullscreen", api.exit);
  return api;
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

const chip = (name: string) => screen.queryByRole("button", { name });

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
    expect(button.textContent, "the name is a label, so the chip stays one sticker wide").toBe("");
  });

  it("is pushed in from a pointer going down on it until it goes up, is cancelled or leaves, as a sticker is", () => {
    fullscreenTab();
    renderChip();
    const button = screen.getByRole("button", { name: "Full screen" });
    for (const end of ["pointerUp", "pointerCancel", "pointerLeave"] as const) {
      fireEvent.pointerDown(button);
      expect(button.hasAttribute("data-pressed"), `down, then ${end}`).toBe(true);
      fireEvent[end](button);
      expect(button.hasAttribute("data-pressed"), `after ${end}`).toBe(false);
    }
  });

  it("goes fullscreen when clicked", () => {
    const { request } = fullscreenTab();
    renderChip();

    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));

    expect(request).toHaveBeenCalledWith({ navigationUI: "hide" });
  });

  it("once fullscreen is the way out, and the way in again when fullscreen ends", () => {
    const { exit } = fullscreenTab();
    renderChip();

    fullscreenChange(document.documentElement);
    expect(chip("Full screen")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
    expect(exit).toHaveBeenCalled();

    fullscreenChange(null);
    expect(chip("Exit full screen")).toBeNull();
    expect(chip("Full screen")).not.toBeNull();
  });

  it("is nothing once the display mode stops being a browser tab", () => {
    fullscreenTab();
    const setBrowser = displayModeQuery();
    renderChip();

    setBrowser(false);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
