// To do:
// [x] hidden at first; reveal() shows, and the controls hide again after the time given
// [x] a reveal while shown starts the time again
// [x] hide() hides at once
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReveal } from "./useReveal";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useReveal", () => {
  it("is hidden at first, shows on reveal(), and hides again after the time given", () => {
    const { result } = renderHook(() => useReveal(3000));
    expect(result.current.shown).toBe(false);

    act(() => result.current.reveal());
    expect(result.current.shown).toBe(true);

    act(() => vi.advanceTimersByTime(2999));
    expect(result.current.shown).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.shown).toBe(false);
  });

  it("starts the time again on a reveal while shown", () => {
    const { result } = renderHook(() => useReveal(3000));
    act(() => result.current.reveal());
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.reveal());

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.shown).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.shown).toBe(false);
  });

  it("hides at once on hide()", () => {
    const { result } = renderHook(() => useReveal(3000));
    act(() => result.current.reveal());
    act(() => result.current.hide());
    expect(result.current.shown).toBe(false);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.shown).toBe(false);
  });
});
