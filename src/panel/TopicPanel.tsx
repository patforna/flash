import type { CSSProperties, ReactNode } from "react";
import styles from "./panel.module.css";

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

// The lead (the fullscreen chip, when there is one), All, then the topics in the deck's order. Nothing selected is All.
export function TopicPanel({ topics, counts, total, selected, onToggle, onAll, colourOf, lead }: TopicPanelProps) {
  return (
    <fieldset aria-label="Topics" className={styles.panel}>
      {lead}
      <Chip
        label={`All · ${total}`}
        name={`All, ${cards(total)}`}
        colour="var(--chalk)"
        place={0}
        pressed={selected.size === 0}
        onClick={onAll}
      />
      {topics.map((topic, i) => (
        <Chip
          key={topic}
          label={topic}
          name={`${topic}, ${cards(counts.get(topic) ?? 0)}`}
          colour={colourOf(topic)}
          place={i + 1}
          pressed={selected.has(topic)}
          onClick={() => onToggle(topic)}
        />
      ))}
    </fieldset>
  );
}

// A selected chip is tilted like a stuck-on sticker, by a fixed angle from its place in the panel.
const TILTS = [-1.5, 1, -0.5, 1.5, -1, 0.5, 1.25];

interface ChipProps {
  label: string;
  name: string;
  colour: string;
  place: number;
  pressed: boolean;
  onClick(): void;
}

function Chip({ label, name, colour, place, pressed, onClick }: ChipProps) {
  const style = { "--sticker": colour, "--tilt": `${TILTS[place % TILTS.length]}deg` } as CSSProperties;
  return (
    <button
      type="button"
      className={styles.chip}
      style={style}
      aria-pressed={pressed}
      aria-label={name}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// Counts live only in the chips' accessible names: on screen they would widen every chip and cost rows.
function cards(count: number): string {
  return count === 1 ? "1 card" : `${count} cards`;
}
