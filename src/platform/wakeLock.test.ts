import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWakeLock } from "./wakeLock";

// To do:
// [x] does nothing where unsupported
// [ ] requests a screen lock on the first pointerdown
// [ ] requests a screen lock on the first keydown
// [ ] keeps the one lock while input continues
// [ ] releases it after five minutes without input
// [ ] releases it after idleMs without input; each input restarts the countdown
// [ ] acquires it again on the next input
// [ ] requests it again when the page becomes visible, if it was held
// [ ] a refused request is not an error
// [ ] cleans up on unmount: releases the lock, stops listening, leaves no timer

describe("useWakeLock", () => {
  it("does nothing where unsupported", () => {
    renderHook(() => useWakeLock(), { reactStrictMode: true });

    expect(() => fireEvent.pointerDown(document.body)).not.toThrow();
  });
});
