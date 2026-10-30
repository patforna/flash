import styles from "./card.module.css";

export interface EndCardProps {
  total: number;
}

// What the end card says: how many were read and how to go again (tap or swipe left reshuffles). The app reads it
// out too.
export function endCardText(total: number) {
  return { title: `That's all ${total}.`, hint: "Tap or swipe to shuffle again." };
}

// Closes a pass: a highlighter tick under the end card's text.
export function EndCard({ total }: EndCardProps) {
  const { title, hint } = endCardText(total);
  return (
    <div className={styles.frame}>
      <div className={`${styles.face} ${styles.end}`}>
        {/* Two strokes of a chisel-tipped highlighter: the nib is held at one angle, so the short stroke runs
            thinner than the long one, and the ink darkens where they cross. */}
        <svg className={styles.tick} viewBox="0 0 122 96" aria-hidden="true">
          <path d="M26.5 55 L52.5 85 L35.5 79 L9.5 49 Z" />
          <path d="M48.5 83 Q83.5 53 112.5 17 L95.5 11 Q66.5 47 31.5 77 Z" />
        </svg>
        <p className={styles.title}>{title}</p>
        <p className={styles.hint}>{hint}</p>
      </div>
    </div>
  );
}
