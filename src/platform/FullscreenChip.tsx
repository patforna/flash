import { type ReactNode, useSyncExternalStore } from "react";
import { canFullscreen, toggleFullscreen } from "./fullscreen";
import styles from "./platform.module.css";

function subscribe(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => {
    document.removeEventListener("fullscreenchange", onChange);
  };
}

export function FullscreenChip(): ReactNode {
  if (!useSyncExternalStore(subscribe, canFullscreen)) return null;
  return (
    <button type="button" className={styles.chip} onClick={toggleFullscreen}>
      <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
      </svg>
      Full screen
    </button>
  );
}
