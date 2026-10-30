import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FullscreenChip } from "./FullscreenChip";

// To do:
// [ ] renders nothing where fullscreen isn't available
// [ ] in a tab that can go fullscreen: a "Full screen" button with an icon hidden from assistive technology
// [ ] goes fullscreen when clicked
// [ ] hides once fullscreen and returns when fullscreen ends (fullscreenchange)
// [ ] hides when the display mode stops being a browser tab (the query's change event)

describe("FullscreenChip", () => {
  it("renders nothing where fullscreen isn't available", () => {
    const { container } = render(<FullscreenChip />, { reactStrictMode: true });

    expect(container.innerHTML).toBe("");
  });
});
