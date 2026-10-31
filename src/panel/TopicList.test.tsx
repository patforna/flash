// To do:
// [x] All first, with the deck's count: never ticked, dim (aria-disabled) while nothing is selected, since there is
//     nothing to clear; the way back once a topic is selected
// [x] the topics follow All in the given order, each pressed while selected, each with its count on show
// [x] each row's accessible name is its text, count and unit included ("Consistency 1 card"), the unit out of sight
// [x] tapping All calls onAll; tapping a topic calls onToggle with its label
// [x] each row carries its colour, as a dot
// [x] a row is pushed in (data-pressed) from a pointer going down on it until it goes up, is cancelled or leaves
import { configure, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { colourFor } from "./colours";
import styles from "./panel.module.css";
import { TopicList, type TopicListProps } from "./TopicList";

configure({ reactStrictMode: true });

const topics = ["Redis", "Postgres", "Queues", "Consistency"];
const counts = new Map([
  ["Redis", 17],
  ["Postgres", 9],
  ["Queues", 6],
  ["Consistency", 1],
]);

function renderList(props: Partial<TopicListProps> = {}) {
  return render(
    <TopicList
      topics={topics}
      counts={counts}
      total={65}
      selected={new Set()}
      onToggle={() => {}}
      onAll={() => {}}
      colourOf={(topic) => colourFor(topics.indexOf(topic))}
      {...props}
    />,
  );
}

const rows = () => screen.getAllByRole("button");
const pressed = (row: HTMLElement) => row.getAttribute("aria-pressed");

describe("TopicList", () => {
  it("puts All first, with the deck's count, never ticked and dim while nothing is selected", () => {
    const onAll = vi.fn();
    renderList({ onAll });
    const [all] = rows();
    expect(all?.textContent).toBe("All 65 cards");
    expect(pressed(all as HTMLElement)).toBeNull();
    expect(all?.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(all as HTMLElement);
    fireEvent.pointerDown(all as HTMLElement);
    expect(onAll).not.toHaveBeenCalled();
    expect(all?.hasAttribute("data-pressed")).toBe(false);
  });

  it("lights All as the way back once a topic is selected, still never ticked", () => {
    renderList({ selected: new Set(["Queues"]) });
    const [all] = rows();
    expect(all?.getAttribute("aria-disabled")).toBe("false");
    expect(pressed(all as HTMLElement)).toBeNull();
  });

  it("lists the topics after All in the given order, pressed while selected, each with its count on show", () => {
    renderList({ selected: new Set(["Postgres", "Consistency"]) });
    const [, ...topicRows] = rows();
    expect(topicRows.map((row) => row.textContent)).toEqual([
      "Redis 17 cards",
      "Postgres 9 cards",
      "Queues 6 cards",
      "Consistency 1 card",
    ]);
    expect(topicRows.map(pressed)).toEqual(["false", "true", "false", "true"]);
  });

  it("names each row from its text, the unit out of sight, one card in the singular", () => {
    renderList();
    expect(
      screen.getByRole("button", { name: "Consistency 1 card" }).querySelector(`.${styles.unit}`)?.textContent,
    ).toBe(" card");
    expect(screen.getByRole("button", { name: "Redis 17 cards" })).toBeTruthy();
  });

  it("calls onAll from All and onToggle with the topic from a topic's row", async () => {
    const onAll = vi.fn();
    const onToggle = vi.fn();
    renderList({ onAll, onToggle, selected: new Set(["Redis"]) });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "All 65 cards" }));
    await user.click(screen.getByRole("button", { name: "Queues 6 cards" }));

    expect(onAll).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("Queues");
  });

  it("gives each row its topic's colour as a dot", () => {
    renderList();
    const dots = rows().map((row) =>
      row.querySelector<HTMLElement>(`.${styles.dot}`)?.style.getPropertyValue("--sticker"),
    );
    expect(dots).toEqual(["var(--chalk)", "var(--s-pink)", "var(--s-marigold)", "var(--s-mint)", "var(--s-sky)"]);
  });

  it("is pushed in from a pointer going down on it until it goes up, is cancelled or leaves", () => {
    renderList();
    const row = screen.getByRole("button", { name: "Redis 17 cards" });
    for (const end of ["pointerUp", "pointerCancel", "pointerLeave"] as const) {
      fireEvent.pointerDown(row);
      expect(row.hasAttribute("data-pressed"), `down, then ${end}`).toBe(true);
      fireEvent[end](row);
      expect(row.hasAttribute("data-pressed"), `after ${end}`).toBe(false);
    }
  });
});
