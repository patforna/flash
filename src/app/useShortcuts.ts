import { useEffect } from "react";

interface Handlers {
  flip(): void;
  next(): void;
  prev(): void;
  reshuffle(): void;
  fullscreen(): void;
}

// Arrows plus h j k l, as in plant-selection (docs/plan.md §4).
const KEYS: Record<string, keyof Handlers> = {
  " ": "flip",
  Enter: "flip",
  ArrowUp: "flip",
  ArrowDown: "flip",
  j: "flip",
  k: "flip",
  ArrowRight: "next",
  l: "next",
  PageDown: "next",
  ArrowLeft: "prev",
  h: "prev",
  PageUp: "prev",
  s: "reshuffle",
  f: "fullscreen",
};

const typing = (target: EventTarget | null) =>
  target instanceof Element && target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])') !== null;

export function useShortcuts(h: Handlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = KEYS[e.key];
      if (!action || e.repeat || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
      e.preventDefault();
      h[action]();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}
