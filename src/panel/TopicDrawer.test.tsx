// To do:
// [x] a dialog named Topics, modal, holding what it is given and the wordmark at its foot
// [x] closed: inert, so nothing in it can be reached, and not open
// [x] open: reachable, and the focus moves to the first selected row (All, with nothing selected)
// [x] Escape closes it while it is open, and does nothing while it is closed
// [x] a tap on the scrim closes it
import { configure, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import styles from "./panel.module.css";
import { TopicDrawer } from "./TopicDrawer";

configure({ reactStrictMode: true });

function renderDrawer(open: boolean, onClose = vi.fn()) {
  const view = render(
    <TopicDrawer open={open} onClose={onClose}>
      <button type="button" aria-pressed="false">
        All
      </button>
      <button type="button" aria-pressed="true">
        Redis
      </button>
    </TopicDrawer>,
  );
  return { ...view, onClose, dialog: screen.getByRole("dialog", { name: "Topics", hidden: true }) };
}

describe("TopicDrawer", () => {
  it("is a modal dialog named Topics, holding what it is given and the wordmark at its foot", () => {
    const { dialog } = renderDrawer(true);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.querySelectorAll("button")).toHaveLength(2);
    expect(dialog.lastElementChild?.textContent).toBe("flash");
    expect(dialog.lastElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("closed, is inert and not open", () => {
    const { dialog } = renderDrawer(false);
    expect(dialog.hasAttribute("inert")).toBe(true);
    expect(dialog.hasAttribute("data-open")).toBe(false);
  });

  it("open, is reachable and moves the focus to the first selected row", () => {
    const { dialog } = renderDrawer(true);
    expect(dialog.hasAttribute("inert")).toBe(false);
    expect(dialog.hasAttribute("data-open")).toBe(true);
    expect(document.activeElement?.textContent).toBe("Redis");
  });

  it("closes on Escape while open, and ignores Escape while closed", () => {
    const { onClose, rerender } = renderDrawer(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <TopicDrawer open={false} onClose={onClose}>
        <button type="button">All</button>
      </TopicDrawer>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a tap on the scrim", () => {
    const { onClose, container } = renderDrawer(true);
    const scrim = container.querySelector(`.${styles.scrim}`);
    if (!scrim) throw new Error("no scrim");
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
