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

export function TopicPanel({ topics, counts, total, selected, onToggle, onAll, lead }: TopicPanelProps) {
  return (
    <fieldset aria-label="Topics">
      {lead}
      <button type="button" aria-pressed={selected.size === 0} aria-label={`All, ${cards(total)}`} onClick={onAll}>
        All · {total}
      </button>
      {topics.map((topic) => (
        <button
          key={topic}
          type="button"
          aria-pressed={selected.has(topic)}
          aria-label={`${topic}, ${cards(counts.get(topic) ?? 0)}`}
          onClick={() => onToggle(topic)}
        >
          {topic}
        </button>
      ))}
    </fieldset>
  );
}

// Counts live only in the chips' accessible names: on screen they would widen every chip and cost rows.
function cards(count: number): string {
  return count === 1 ? "1 card" : `${count} cards`;
}
