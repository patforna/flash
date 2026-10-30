import { afterEach, describe, expect, it, vi } from "vitest";
import { canFullscreen } from "./fullscreen";

// To do:
// [ ] canFullscreen: false where fullscreen isn't enabled
// [ ] canFullscreen: true in a browser tab with fullscreen enabled and nothing fullscreen
// [ ] canFullscreen: false outside a browser tab (the installed app)
// [ ] canFullscreen: false while something is fullscreen
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
});
