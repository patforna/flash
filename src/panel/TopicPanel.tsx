import type { ReactNode } from "react";

export interface TopicPanelProps {
  topics: readonly string[];
  counts: ReadonlyMap<string, number>;
  total: number;
  selected: ReadonlySet<string>;
  onToggle(label: string): void;
  onAll(): void;
  colourOf(topic: string): string;
  lead?: ReactNode;
}

export function TopicPanel({ topics, total, selected }: TopicPanelProps) {
  return (
    <fieldset aria-label="Topics">
      <button type="button" aria-pressed={selected.size === 0}>
        All · {total}
      </button>
      {topics.map((topic) => (
        <button key={topic} type="button" aria-pressed={selected.has(topic)}>
          {topic}
        </button>
      ))}
    </fieldset>
  );
}
