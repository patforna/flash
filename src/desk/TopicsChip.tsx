import type { CSSProperties, Ref } from "react";
import { press } from "../panel/press";
import styles from "./desk.module.css";
import { summarise } from "./summarise";

export interface TopicsChipProps {
  // The selected topics, in the deck's order.
  selected: readonly string[];
  colourOf(topic: string): string;
  open: boolean;
  onClick(): void;
  ref?: Ref<HTMLButtonElement>;
}

// A 44 px sticker that opens the topics: a list glyph while every topic is read, the selected topics' dots in their
// colours otherwise (up to three, then a plus). Its name says what is being read.
export function TopicsChip({ selected, colourOf, open, onClick, ref }: TopicsChipProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={styles.chip}
      aria-label={`Topics: ${summarise(selected)}`}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onClick}
      {...press}
    >
      {selected.length === 0 ? (
        <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 4h12M2 8h12M2 12h8" />
        </svg>
      ) : (
        <span className={styles.dots} aria-hidden="true">
          {selected.slice(0, 3).map((topic) => (
            <i key={topic} style={{ "--sticker": colourOf(topic) } as CSSProperties} />
          ))}
          {selected.length > 3 && <b>+</b>}
        </span>
      )}
    </button>
  );
}
