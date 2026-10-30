import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "./wakeLock";

// To do:
// [x] does nothing where unsupported
// [x] requests a screen lock on the first pointerdown
// [x] requests a screen lock on the first keydown
// [x] keeps the one lock while input continues
// [x] releases it after five minutes without input
// [x] releases it after idleMs without input; each input restarts the countdown
// [x] acquires it again on the next input
// [x] requests it again when the page becomes visible, if it was held
// [x] a refused request is not an error
// [x] cleans up on unmount: releases the lock, stops listening, leaves no timer

// happy-dom has no Screen Wake Lock API: this one hands out sentinels and keeps them for the test to inspect.
function wakeLockApi() {
  const sentinels: { release: () => Promise<void> }[] = [];
  const request = vi.fn(async () => {
    const sentinel = { release: vi.fn(async () => {}) };
    sentinels.push(sentinel);
    return sentinel;
  });
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
  return { request, sentinels };
}

// The browser drops a screen lock while the page is hidden, then the reader comes back to it.
function pageBecomes(state: DocumentVisibilityState) {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "wakeLock");
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useWakeLock", () => {
  it("does nothing where unsupported", () => {
    renderHook(() => useWakeLock(), { reactStrictMode: true });

    expect(() => fireEvent.pointerDown(document.body)).not.toThrow();
  });

  it("requests a screen lock on the first pointerdown", () => {
    const { request } = wakeLockApi();
    renderHook(() => useWakeLock(), { reactStrictMode: true });
    expect(request).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body);

    expect(request).toHaveBeenCalledWith("screen");
  });

  it("requests a screen lock on the first keydown", () => {
    const { request } = wakeLockApi();
    renderHook(() => useWakeLock(), { reactStrictMode: true });

    fireEvent.keyDown(document.body, { key: "ArrowRight" });

    expect(request).toHaveBeenCalledWith("screen");
  });

  it("keeps the one lock while input continues", () => {
    const { request } = wakeLockApi();
    renderHook(() => useWakeLock(), { reactStrictMode: true });

    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    fireEvent.pointerDown(document.body);

    expect(request).toHaveBeenCalledTimes(1);
  });

  it("releases it after five minutes without input", async () => {
    const { sentinels } = wakeLockApi();
    renderHook(() => useWakeLock(), { reactStrictMode: true });
    fireEvent.pointerDown(document.body);

    await vi.advanceTimersByTimeAsync(5 * 60_000 - 1);
    expect(sentinels[0]?.release).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(sentinels[0]?.release).toHaveBeenCalled();
  });

  it("releases it after idleMs without input, each input restarting the countdown", async () => {
    const { sentinels } = wakeLockApi();
    renderHook(() => useWakeLock(1000), { reactStrictMode: true });
    fireEvent.pointerDown(document.body);
    await vi.advanceTimersByTimeAsync(600);
    fireEvent.keyDown(document.body, { key: "ArrowRight" });

    await vi.advanceTimersByTimeAsync(999);
    expect(sentinels[0]?.release).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(sentinels[0]?.release).toHaveBeenCalled();
  });

  it("acquires it again on the next input", async () => {
    const { request } = wakeLockApi();
    renderHook(() => useWakeLock(1000), { reactStrictMode: true });
    fireEvent.pointerDown(document.body);
    await vi.advanceTimersByTimeAsync(1000);

    fireEvent.pointerDown(document.body);

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("requests it again when the page becomes visible, if it was held", () => {
    const { request } = wakeLockApi();
    renderHook(() => useWakeLock(), { reactStrictMode: true });
    fireEvent.pointerDown(document.body);

    pageBecomes("hidden");
    pageBecomes("visible");

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("asks for nothing when the page becomes visible, unless it was held", async () => {
    const { request } = wakeLockApi();
    renderHook(() => useWakeLock(1000), { reactStrictMode: true });
    pageBecomes("hidden");
    pageBecomes("visible");
    expect(request).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body);
    await vi.advanceTimersByTimeAsync(1000);
    pageBecomes("hidden");
    pageBecomes("visible");
    expect(request).toHaveBeenCalledTimes(1);
  });

  // Vitest fails the run on an unhandled rejection.
  it("shrugs off refused requests, on input and on return", async () => {
    const { request } = wakeLockApi();
    request.mockRejectedValue(new DOMException("Battery saver is on", "NotAllowedError"));
    renderHook(() => useWakeLock(1000), { reactStrictMode: true });

    fireEvent.pointerDown(document.body);
    pageBecomes("hidden");
    pageBecomes("visible");
    await vi.advanceTimersByTimeAsync(1000);
  });

  it("cleans up on unmount: releases the lock, stops listening, leaves no timer", async () => {
    const { request, sentinels } = wakeLockApi();
    const { unmount } = renderHook(() => useWakeLock(), { reactStrictMode: true });
    fireEvent.pointerDown(document.body);

    unmount();
    await vi.advanceTimersByTimeAsync(0);
    fireEvent.pointerDown(document.body);

    expect(sentinels[0]?.release).toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
