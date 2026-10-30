import { afterEach, describe, expect, it, vi } from "vitest";
import { tick } from "./haptics";

// To do:
// [x] vibrates for 8 ms under a coarse pointer
// [x] vibrates for the given duration
// [x] keeps still under a fine pointer
// [x] never throws: no vibration API; a vibration that throws

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

  it("vibrates for the given duration", () => {
    coarsePointer();
    const vibrate = vibration();

    tick(20);

    expect(vibrate).toHaveBeenCalledWith(20);
  });

  it("keeps still under a fine pointer", () => {
    const vibrate = vibration();

    tick();

    expect(vibrate).not.toHaveBeenCalled();
  });

  it("never throws where there is no vibration API", () => {
    coarsePointer();

    expect(() => tick()).not.toThrow();
  });

  it("never throws when the vibration does", () => {
    coarsePointer();
    vibration().mockImplementation(() => {
      throw new DOMException("Blocked", "NotAllowedError");
    });

    expect(() => tick()).not.toThrow();
  });
});
