import { afterEach, describe, expect, it, vi } from "vitest";
import { tick } from "./haptics";

// To do:
// [ ] vibrates for 8 ms under a coarse pointer
// [ ] vibrates for the given duration
// [ ] keeps still under a fine pointer
// [ ] never throws: no vibration API; a vibration that throws

// happy-dom matches (pointer: coarse) when the device reports touch points.
function coarsePointer() {
  vi.spyOn(navigator, "maxTouchPoints", "get").mockReturnValue(5);
}

function vibration() {
  const vibrate = vi.fn(() => true);
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
  return vibrate;
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "vibrate");
});

describe("tick", () => {
  it("vibrates for 8 ms under a coarse pointer", () => {
    coarsePointer();
    const vibrate = vibration();

    tick();

    expect(vibrate).toHaveBeenCalledWith(8);
  });
});
