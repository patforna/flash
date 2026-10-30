import { afterEach, describe, expect, it, vi } from "vitest";
import { canFullscreen, toggleFullscreen } from "./fullscreen";

// To do:
// [x] canFullscreen: false where fullscreen isn't enabled
// [x] canFullscreen: true in a browser tab with fullscreen enabled and nothing fullscreen
// [x] canFullscreen: false outside a browser tab (the installed app)
// [x] canFullscreen: false while something is fullscreen
// [ ] toggleFullscreen: requests fullscreen on the document element, without navigation UI
// [ ] toggleFullscreen: then locks the orientation to landscape, once fullscreen has been entered
// [ ] toggleFullscreen: exits when fullscreen
// [ ] toggleFullscreen: swallows a SecurityError, a NotSupportedError and a missing API

// happy-dom has no Fullscreen API and no screen.orientation: each test defines what it needs, removed afterwards.
const defined: [object, string][] = [];

function define(target: object, key: string, value: unknown) {
  Object.defineProperty(target, key, { configurable: true, value });
  defined.push([target, key]);
}

// happy-dom always reports a browser tab; the installed app runs in display-mode fullscreen.
function displayMode(mode: string) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === `(display-mode: ${mode})` }));
}

afterEach(() => {
  for (const [target, key] of defined.splice(0)) Reflect.deleteProperty(target, key);
  vi.unstubAllGlobals();
});

describe("canFullscreen", () => {
  it("is false where fullscreen isn't enabled", () => {
    expect(canFullscreen()).toBe(false);
  });

  // happy-dom matches (display-mode: browser), as a tab does.
  it("is true in a browser tab with fullscreen enabled and nothing fullscreen", () => {
    define(document, "fullscreenEnabled", true);
    define(document, "fullscreenElement", null);

    expect(canFullscreen()).toBe(true);
  });

  it("is false outside a browser tab, as in the installed app", () => {
    define(document, "fullscreenEnabled", true);
    define(document, "fullscreenElement", null);
    displayMode("fullscreen");

    expect(canFullscreen()).toBe(false);
  });

  it("is false while something is fullscreen", () => {
    define(document, "fullscreenEnabled", true);
    define(document, "fullscreenElement", document.documentElement);

    expect(canFullscreen()).toBe(false);
  });
});

describe("toggleFullscreen", () => {
  it("requests fullscreen on the document element, without navigation UI", async () => {
    const request = vi.fn(async () => {});
    define(document.documentElement, "requestFullscreen", request);

    await toggleFullscreen();

    expect(request).toHaveBeenCalledWith({ navigationUI: "hide" });
  });
});
