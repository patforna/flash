// To do:
// [x] a group named "Topics"
// [ ] All reads "All · 65" and is pressed when nothing is selected
// [ ] All is not pressed while a topic is selected
// [ ] the topics follow All in the given order, each pressed while selected
// [ ] each chip's accessible name carries its count, "1 card" for one
// [ ] the lead comes first
// [ ] tapping All calls onAll; tapping a topic calls onToggle with its label
// [ ] each chip carries its colour, and a fixed tilt within ±1.5° that differs from its neighbours'
import { configure, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
