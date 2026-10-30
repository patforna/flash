// To do:
// [x] shows the title alone when there is no hint
// [x] shows the hint under the title
// [ ] writes in pencil by default, in red ink for an error
// [ ] the whole card is one button when it can be tapped, named by its words
// [ ] sits on the same frame and face as a card
import { configure, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageCard } from "./MessageCard";

configure({ reactStrictMode: true });

describe("MessageCard", () => {
  it("shows the title alone when there is no hint", () => {
    const { container } = render(<MessageCard title="shuffling…" />);
    expect(container.textContent).toBe("shuffling…");
  });

  it("shows the hint under the title", () => {
    render(<MessageCard title="Can't reach the deck." hint="Tap to try again" />);
    expect(screen.getByText("Can't reach the deck.")).toBeTruthy();
    expect(screen.getByText("Tap to try again")).toBeTruthy();
  });
});
