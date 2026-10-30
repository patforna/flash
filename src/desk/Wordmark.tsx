import styles from "./desk.module.css";

// The "flash" wordmark, written in highlighter at the foot of the panel. Decoration only.
export function Wordmark() {
  return (
    <span className={styles.wordmark} aria-hidden="true">
      flash
    </span>
  );
}
