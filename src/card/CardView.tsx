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
        <div className={styles.face} />
        <div className={`${styles.face} ${styles.back}`} />
      </div>
    </div>
  );
}
