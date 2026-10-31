import type { CSSProperties } from "react";
import styles from "./panel.module.css";
import { press } from "./press";

export interface TopicListProps {
  topics: readonly string[];
  counts: ReadonlyMap<string, number>;
  total: number;
  selected: ReadonlySet<string>;
  onToggle(label: string): void;
  onAll(): void;
  colourOf(topic: string): string;
}

// One row per topic, All first, each with its dot in the topic's colour, its count and a tick while selected. Nothing
// selected is All. A row's name comes from its text, "Redis 2 cards": what is read matches what is seen (WCAG 2.5.3),
// the unit hidden from sight.
export function TopicList({ topics, counts, total, selected, onToggle, onAll, colourOf }: TopicListProps) {
  return (
    <div className={styles.list}>
      <Row label="All" count={total} colour="var(--chalk)" pressed={selected.size === 0} onClick={onAll} />
      {topics.map((topic) => (
        <Row
          key={topic}
          label={topic}
          count={counts.get(topic) ?? 0}
          colour={colourOf(topic)}
          pressed={selected.has(topic)}
          onClick={() => onToggle(topic)}
        />
      ))}
    </div>
  );
}

interface RowProps {
  label: string;
  count: number;
  colour: string;
  pressed: boolean;
  onClick(): void;
}

function Row({ label, count, colour, pressed, onClick }: RowProps) {
  return (
    <button type="button" className={styles.row} aria-pressed={pressed} onClick={onClick} {...press}>
      <span className={styles.dot} style={{ "--sticker": colour } as CSSProperties} />
      <span className={styles.label}>{label}</span>{" "}
      <span className={styles.count}>
        {count}
        <span className={styles.unit}>{count === 1 ? " card" : " cards"}</span>
      </span>
    </button>
  );
}
