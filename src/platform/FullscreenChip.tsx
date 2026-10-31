import { type ReactNode, useSyncExternalStore } from "react";
import { press } from "../panel/press";
import { canFullscreen, toggleFullscreen } from "./fullscreen";
import styles from "./platform.module.css";

// Entering or leaving fullscreen, or the display mode changing (a desktop browser's own fullscreen fires no
// fullscreenchange), may show or hide the chip.
function subscribe(onChange: () => void) {
  const tab = matchMedia("(display-mode: browser)");
  document.addEventListener("fullscreenchange", onChange);
  tab.addEventListener("change", onChange);
  return () => {
    document.removeEventListener("fullscreenchange", onChange);
    tab.removeEventListener("change", onChange);
  };
}

export function FullscreenChip(): ReactNode {
  const shown = useSyncExternalStore(subscribe, canFullscreen);
  if (!shown) return null;
  return (
    <button type="button" className={styles.chip} aria-label="Full screen" onClick={toggleFullscreen} {...press}>
      <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
      </svg>
    </button>
  );
}
