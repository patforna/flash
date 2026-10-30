import styles from "./card.module.css";

export interface EndCardProps {
  total: number;
}

// Closes a pass: a highlighter tick, how many were read and how to go again (tap or swipe left reshuffles).
export function EndCard({ total }: EndCardProps) {
  return (
    <div className={styles.frame}>
      <div className={`${styles.face} ${styles.end}`}>
        <svg className={styles.tick} viewBox="0 0 120 100" aria-hidden="true">
          <path d="M14 58 C22 63 31 72 40 86 C55 58 76 32 108 12" />
        </svg>
        <p className={styles.title}>That's all {total}.</p>
        <p className={styles.hint}>Tap or swipe to shuffle again.</p>
      </div>
    </div>
  );
}
