import { type ReactNode, useSyncExternalStore } from "react";
import { press } from "../panel/press";
import { canFullscreen, isFullscreen, toggleFullscreen } from "./fullscreen";
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

export interface FullscreenChipProps {
  // The way out: shown only while the tab is fullscreen, where the way in has no place.
  exit?: boolean;
  className?: string;
}

// Corner brackets pointing out: go fullscreen. Pointing in: come back.
const ICON = {
  enter: "M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4",
  exit: "M6 2v4H2M10 2v4h4M14 10h-4v4M2 10h4v4",
};

export function FullscreenChip({ exit = false, className }: FullscreenChipProps): ReactNode {
  const shown = useSyncExternalStore(subscribe, exit ? isFullscreen : canFullscreen);
  if (!shown) return null;
  return (
    <button
      type="button"
      className={className ? `${styles.chip} ${className}` : styles.chip}
      aria-label={exit ? "Exit full screen" : "Full screen"}
      onClick={toggleFullscreen}
      {...press}
    >
      <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
        <path d={exit ? ICON.exit : ICON.enter} />
      </svg>
    </button>
  );
}
