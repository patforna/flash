// To do:
// [x] a group named "Topics"
// [x] All reads "All · 65" and is pressed when nothing is selected
// [x] All is not pressed while a topic is selected
// [x] the topics follow All in the given order, each pressed while selected
// [x] each chip's accessible name carries its count, "1 card" for one
// [x] the lead comes first
// [x] tapping All calls onAll; tapping a topic calls onToggle with its label
// [x] each chip carries its colour, and a fixed tilt within ±1.5° that differs from its neighbours'
import { configure, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { colourFor } from "./colours";
import { TopicPanel, type TopicPanelProps } from "./TopicPanel";

configure({ reactStrictMode: true });

const topics = ["Redis", "Postgres", "Queues", "Consistency"];
const counts = new Map([
  ["Redis", 17],
  ["Postgres", 9],
  ["Queues", 6],
  ["Consistency", 1],
]);

function renderPanel(props: Partial<TopicPanelProps> = {}) {
  return render(
    <TopicPanel
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

describe("TopicPanel", () => {
  it('is a group named "Topics"', () => {
    renderPanel();
    expect(screen.getByRole("group", { name: "Topics" })).toBeTruthy();
  });

  it('reads "All · 65" on the All chip, pressed while nothing is selected', () => {
    renderPanel();
    const all = screen.getByRole("button", { name: /^All/ });
    expect(all.textContent).toBe("All · 65");
    expect(all.getAttribute("aria-pressed")).toBe("true");
  });

  it("does not press All while a topic is selected", () => {
    renderPanel({ selected: new Set(["Queues"]) });
    expect(screen.getByRole("button", { name: /^All/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("lists the topics after All in the given order, each pressed while selected", () => {
    renderPanel({ selected: new Set(["Postgres", "Consistency"]) });
    const chips = screen.getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual(["All · 65", "Redis", "Postgres", "Queues", "Consistency"]);
    expect(chips.map((chip) => chip.getAttribute("aria-pressed"))).toEqual(["false", "false", "true", "false", "true"]);
  });

  it.each(["All, 65 cards", "Redis, 17 cards", "Queues, 6 cards", "Consistency, 1 card"])(
    'names a chip with its count of cards: "%s"',
    (name) => {
      renderPanel();
      expect(screen.getByRole("button", { name })).toBeTruthy();
    },
  );

  it("puts the lead before All", () => {
    renderPanel({ lead: <button type="button">Full screen</button> });
    const chips = screen.getAllByRole("button").map((chip) => chip.textContent);
    expect(chips.slice(0, 2)).toEqual(["Full screen", "All · 65"]);
  });

  it("calls onAll for All and onToggle with the label for a topic", async () => {
    const onAll = vi.fn();
    const onToggle = vi.fn();
    renderPanel({ selected: new Set(["Redis"]), onAll, onToggle });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Queues/ }));
    await user.click(screen.getByRole("button", { name: /^All/ }));
    expect(onToggle.mock.calls).toEqual([["Queues"]]);
    expect(onAll).toHaveBeenCalledOnce();
  });

  it("gives each chip its colour, All the chalk's", () => {
    renderPanel();
    expect(screen.getAllByRole("button").map((chip) => chip.style.getPropertyValue("--sticker"))).toEqual([
      "var(--chalk)",
      "var(--s-pink)",
      "var(--s-marigold)",
      "var(--s-mint)",
      "var(--s-sky)",
    ]);
  });

  it("tilts each chip by a fixed angle within ±1.5°, unlike its neighbours", () => {
    const tilts = () =>
      screen.getAllByRole("button").map((chip) => Number.parseFloat(chip.style.getPropertyValue("--tilt")));
    const { unmount } = renderPanel();
    const first = tilts();
    unmount();
    renderPanel({ selected: new Set(["Redis", "Queues"]) });
    expect(tilts()).toEqual(first);
    expect(first.every((tilt) => tilt !== 0 && Math.abs(tilt) <= 1.5)).toBe(true);
    expect(first.slice(1).every((tilt, i) => tilt !== first[i])).toBe(true);
  });
});
