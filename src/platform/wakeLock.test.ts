import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "./wakeLock";

// To do:
// [x] does nothing where unsupported
// [x] requests a screen lock on the first pointerdown
// [x] requests a screen lock on the first keydown
// [x] keeps the one lock while input continues
// [x] releases it after five minutes without input
// [ ] releases it after idleMs without input; each input restarts the countdown
// [ ] acquires it again on the next input
// [ ] requests it again when the page becomes visible, if it was held
// [ ] a refused request is not an error
// [ ] cleans up on unmount: releases the lock, stops listening, leaves no timer

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

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "wakeLock");
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
});
