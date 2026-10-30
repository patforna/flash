// To do:
// [x] shows the title alone when there is no hint
// [x] shows the hint under the title
// [x] writes in pencil by default, in red ink for an error
// [x] the whole card is one button when it can be tapped, named by its words
// [ ] sits on the same frame and face as a card
import { configure, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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

  it.each([
    [undefined, "pencil"],
    ["pencil", "pencil"],
    ["error", "error"],
  ] as const)("with tone %s writes in %s", (tone, ink) => {
    const { container } = render(<MessageCard title="No cards here." tone={tone} />);
    expect(container.querySelector<HTMLElement>("[data-tone]")?.dataset.tone).toBe(ink);
  });

  it("is one button, named by its words, when it can be tapped", async () => {
    const onTap = vi.fn();
    render(<MessageCard title="Can't reach the deck." hint="Tap to try again" tone="error" onTap={onTap} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Can't reach the deck. Tap to try again" }));
    expect(onTap).toHaveBeenCalledOnce();
  });

  it("is no button when it can't be tapped", () => {
    render(<MessageCard title="shuffling…" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
