import type { Card } from "../../shared/types";
import type { Side } from "../deck/types";
import styles from "./card.module.css";

export interface CardViewProps {
  card: Card;
  side: Side;
  position: number;
  total: number;
  colourOf(topic: string): string;
}

export function CardView({ side }: CardViewProps) {
  return (
    <div className={styles.frame}>
      <div className={styles.flipper} data-side={side}>
        <div className={styles.face} {...hiddenUnless(side === "front")} />
        <div className={`${styles.face} ${styles.back}`} {...hiddenUnless(side === "back")} />
      </div>
    </div>
  );
}

// The face turned away takes no input and is hidden from assistive tech.
function hiddenUnless(shown: boolean) {
  return shown ? {} : { inert: true, "aria-hidden": true };
}
