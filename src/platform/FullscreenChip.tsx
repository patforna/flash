import { type ReactNode, useSyncExternalStore } from "react";
import styles from "../desk/desk.module.css";
import { press } from "../panel/press";
import { canFullscreen, isFullscreen, toggleFullscreen } from "./fullscreen";

// Entering or leaving fullscreen, or the display mode changing (a desktop browser's own fullscreen fires no
// fullscreenchange), may change what the chip is.
function subscribe(onChange: () => void) {
  const tab = matchMedia("(display-mode: browser)");
  document.addEventListener("fullscreenchange", onChange);
  tab.addEventListener("change", onChange);
  return () => {
    document.removeEventListener("fullscreenchange", onChange);
    tab.removeEventListener("change", onChange);
  };
}

// The way in, from a tab that offers fullscreen; the way out, once the tab is fullscreen; nothing in the installed
// app, which is fullscreen by its manifest with nothing to leave.
const state = () => (isFullscreen() ? "exit" : canFullscreen() ? "enter" : "none");

// Corner brackets pointing out: go fullscreen. Pointing in: come back.
const ICON = {
  enter: "M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4",
  exit: "M6 2v4H2M10 2v4h4M14 10h-4v4M2 10h4v4",
};

export function FullscreenChip(): ReactNode {
  const mode = useSyncExternalStore(subscribe, state);
  if (mode === "none") return null;
  return (
    <button
      type="button"
      className={styles.chip}
      aria-label={mode === "exit" ? "Exit full screen" : "Full screen"}
      onClick={toggleFullscreen}
      {...press}
    >
      <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
        <path d={ICON[mode]} />
      </svg>
    </button>
  );
}
