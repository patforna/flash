// To do:
// [x] named for what is being read, and expanded while the drawer is open
// [x] a list glyph while every topic is read; the selected topics' dots in their colours otherwise, three at most and a plus
// [x] opens on click; pushed in (data-pressed) under a pointer
import { configure, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { colourFor } from "../panel/colours";
import styles from "./desk.module.css";
import { TopicsChip } from "./TopicsChip";

configure({ reactStrictMode: true });

const topics = ["Redis", "Postgres", "Queues", "Consistency"];

function renderChip(selected: string[], props: { open?: boolean; onClick?: () => void } = {}) {
  const { container } = render(
    <TopicsChip
      selected={selected}
      colourOf={(topic) => colourFor(topics.indexOf(topic))}
      open={props.open ?? false}
      onClick={props.onClick ?? (() => {})}
    />,
  );
  const chip = container.querySelector("button");
  if (!chip) throw new Error("no chip");
  return chip;
}

describe("TopicsChip", () => {
  it("is named for what is being read, and expanded while the drawer is open", () => {
    expect(renderChip([]).getAttribute("aria-label")).toBe("Topics: all topics");
    const chip = renderChip(["Redis", "Queues"], { open: true });
    expect(chip.getAttribute("aria-label")).toBe("Topics: Redis, Queues");
    expect(chip.getAttribute("aria-expanded")).toBe("true");
  });

  it("shows a list glyph while every topic is read", () => {
    const chip = renderChip([]);
    expect(chip.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(chip.querySelector(`.${styles.dots}`)).toBeNull();
  });

  it("shows the selected topics as dots in their colours, three at most and then a plus", () => {
    const two = renderChip(["Redis", "Queues"]);
    expect(Array.from(two.querySelectorAll("i"), (dot) => dot.style.getPropertyValue("--sticker"))).toEqual([
      "var(--s-pink)",
      "var(--s-mint)",
    ]);
    expect(two.querySelector("b")).toBeNull();

    const four = renderChip(topics);
    expect(four.querySelectorAll("i")).toHaveLength(3);
    expect(four.querySelector("b")?.textContent).toBe("+");
  });

  it("opens on click, and is pushed in under a pointer", () => {
    const onClick = vi.fn();
    const chip = renderChip([], { onClick });
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(chip);
    expect(chip.hasAttribute("data-pressed")).toBe(true);
    fireEvent.pointerUp(chip);
    expect(chip.hasAttribute("data-pressed")).toBe(false);
  });
});
