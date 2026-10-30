import type { ReactNode } from "react";
import { canFullscreen } from "./fullscreen";
import styles from "./platform.module.css";

export function FullscreenChip(): ReactNode {
  if (!canFullscreen()) return null;
  return (
    <button type="button" className={styles.chip}>
      <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
      </svg>
      Full screen
    </button>
  );
}
