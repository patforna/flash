import type { ReactNode } from "react";
import styles from "./stage.module.css";

// The stage before there is a pass to read: one card that isn't from the deck (loading, error, empty) on top of the
// full stack, in the card's place. Nothing here moves.
export function StillStage({ children }: { children: ReactNode }) {
  return (
    <div className={styles.stage}>
      <div className={styles.box}>
        <div className={styles.blank} data-shown />
        <div className={styles.blank} data-shown />
        {children}
      </div>
    </div>
  );
}
