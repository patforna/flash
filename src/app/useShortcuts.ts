import { useEffect } from "react";

interface Handlers {
  flip(): void;
  down(): void; // down a page of the back, or a flip where there is none
  up(): void; // up a page, or a flip
  next(): void;
  prev(): void;
  reshuffle(): void;
  fullscreen(): void;
  topics(): void;
}

// Arrows plus h j k l, as in plant-selection (docs/plan.md §4); the vertical keys turn the pages of a back that has
// them, and flip otherwise.
const KEYS: Record<string, keyof Handlers> = {
  " ": "flip",
  Enter: "flip",
  ArrowUp: "up",
  ArrowDown: "down",
  j: "down",
  k: "up",
  ArrowRight: "next",
  l: "next",
  PageDown: "next",
  ArrowLeft: "prev",
  h: "prev",
  PageUp: "prev",
  s: "reshuffle",
  f: "fullscreen",
  t: "topics",
};

const within = (target: EventTarget | null, selector: string) =>
  target instanceof Element && target.closest(selector) !== null;
const FIELDS = 'input, textarea, [contenteditable]:not([contenteditable="false"])';
const DIALOG = '[role="dialog"]';

export function useShortcuts(h: Handlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = KEYS[e.key];
      if (!action || e.repeat || e.altKey || e.ctrlKey || e.metaKey || within(e.target, FIELDS)) return;
      // A focused button presses itself on Space and Enter.
      if ((e.key === " " || e.key === "Enter") && within(e.target, "button")) return;
      // In the topic drawer the cards are under a scrim: only its own key means anything (Escape is the drawer's).
      if (action !== "topics" && within(e.target, DIALOG)) return;
      e.preventDefault();
      h[action]();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}
