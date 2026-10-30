// To do:
// [x] lays its one card on a full stack, in the card's place: both blank cards show behind it
// (Styles aren't computed here: happy-dom gets no CSS modules.)
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { StillStage } from "./StillStage";

describe("StillStage", () => {
  test("lays its one card on a full stack: both blank cards show behind it", () => {
    const { container } = render(
      <StillStage>
        <p>shuffling…</p>
      </StillStage>,
    );

    const box = container.firstElementChild?.firstElementChild;
    const stack = Array.from(box?.children ?? [], (el) => (el.hasAttribute("data-shown") ? "blank" : el.textContent));
    expect(stack).toEqual(["blank", "blank", "shuffling…"]);
  });
});
