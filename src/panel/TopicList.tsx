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

// One row per topic, each with its dot in the topic's colour, its count and a tick while selected, under All. All is
// the default, not a choice: never ticked, dim while nothing is selected (there is nothing to clear), the way back to
// the whole deck once something is. So the ticks only ever move where the thumb was: deselecting the last topic
// leaves no tick behind, where a tick jumping up to All read as nervous. A row's name comes from its text,
// "Redis 2 cards": what is read matches what is seen (WCAG 2.5.3), the unit hidden from sight.
export function TopicList({ topics, counts, total, selected, onToggle, onAll, colourOf }: TopicListProps) {
  return (
    <div className={styles.list}>
      <All total={total} active={selected.size > 0} onClick={onAll} />
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

interface AllProps {
  total: number;
  active: boolean;
  onClick(): void;
}

function All({ total, active, onClick }: AllProps) {
  return (
    <button
      type="button"
      className={styles.row}
      data-all=""
      aria-disabled={!active}
      onClick={active ? onClick : undefined}
      {...(active ? press : {})}
    >
      <Text label="All" count={total} colour="var(--chalk)" />
    </button>
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
      <Text label={label} count={count} colour={colour} />
    </button>
  );
}

function Text({ label, count, colour }: { label: string; count: number; colour: string }) {
  return (
    <>
      <span className={styles.dot} style={{ "--sticker": colour } as CSSProperties} />
      <span className={styles.label}>{label}</span>{" "}
      <span className={styles.count}>
        {count}
        <span className={styles.unit}>{count === 1 ? " card" : " cards"}</span>
      </span>
    </>
  );
}
