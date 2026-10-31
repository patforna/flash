import styles from "./desk.module.css";

// The "flash" wordmark: typed, in ink, over one highlighter stroke, at the foot of the topic drawer. Decoration only.
export function Wordmark() {
  return (
    <span className={styles.wordmark} aria-hidden="true">
      <i className={styles.swipe} />
      <span>flash</span>
    </span>
  );
}
