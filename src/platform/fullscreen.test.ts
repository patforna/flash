import { afterEach, describe, expect, it, vi } from "vitest";
import { canFullscreen, toggleFullscreen } from "./fullscreen";

// To do:
// [x] canFullscreen: false where fullscreen isn't enabled
// [x] canFullscreen: true in a browser tab with fullscreen enabled and nothing fullscreen
// [x] canFullscreen: false outside a browser tab (the installed app)
// [x] canFullscreen: false while something is fullscreen
// [x] toggleFullscreen: requests fullscreen on the document element, without navigation UI
// [x] toggleFullscreen: then locks the orientation to landscape, once fullscreen has been entered
// [x] toggleFullscreen: exits when fullscreen
// [ ] toggleFullscreen: swallows a SecurityError, a NotSupportedError and a missing API

// happy-dom has no Fullscreen API and no screen.orientation: each test defines what it needs, removed afterwards.
const defined: [object, string][] = [];

function define(target: object, key: string, value: unknown) {
  Object.defineProperty(target, key, { configurable: true, value });
  defined.push([target, key]);
}

// A tab that can go fullscreen and lock its orientation, not fullscreen yet.
function fullscreenApi() {
  const api = { request: vi.fn(async () => {}), exit: vi.fn(async () => {}), lock: vi.fn(async () => {}) };
  define(document, "fullscreenEnabled", true);
  define(document, "fullscreenElement", null);
  define(document.documentElement, "requestFullscreen", api.request);
  define(document, "exitFullscreen", api.exit);
  define(screen, "orientation", { lock: api.lock });
  return api;
}

function enterFullscreen() {
  define(document, "fullscreenElement", document.documentElement);
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
    fullscreenApi();

    expect(canFullscreen()).toBe(true);
  });

  it("is false outside a browser tab, as in the installed app", () => {
    fullscreenApi();
    displayMode("fullscreen");

    expect(canFullscreen()).toBe(false);
  });

  it("is false while something is fullscreen", () => {
    fullscreenApi();
    enterFullscreen();

    expect(canFullscreen()).toBe(false);
  });
});

describe("toggleFullscreen", () => {
  it("requests fullscreen on the document element, without navigation UI", async () => {
    const { request } = fullscreenApi();

    await toggleFullscreen();

    expect(request).toHaveBeenCalledWith({ navigationUI: "hide" });
  });

  it("then locks the orientation to landscape, once fullscreen has been entered", async () => {
    const { request, lock } = fullscreenApi();
    const entered = Promise.withResolvers<void>();
    request.mockReturnValue(entered.promise);

    const toggled = toggleFullscreen();
    await Promise.resolve();
    expect(lock).not.toHaveBeenCalled();

    entered.resolve();
    await toggled;
    expect(lock).toHaveBeenCalledWith("landscape");
  });

  it("exits when fullscreen", async () => {
    const { request, exit } = fullscreenApi();
    enterFullscreen();

    await toggleFullscreen();

    expect(exit).toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("swallows a refused request (SecurityError)", async () => {
    const { request } = fullscreenApi();
    request.mockRejectedValue(new DOMException("Not allowed", "SecurityError"));

    await expect(toggleFullscreen()).resolves.toBeUndefined();
  });
});
