import { useEffect } from "react";
import { isTap, type Sample } from "../gesture/gesture";

// The desk is the whole screen but the cards, the controls and the drawer.
const onDesk = (target: EventTarget | null) =>
  target instanceof Element && target.closest('[data-role], button, [role="dialog"]') === null;

const sample = (e: PointerEvent): Sample => ({ x: e.clientX, y: e.clientY, t: e.timeStamp });

// A tap on the desk: a pointer that goes down on it and comes up within a tap's slop and time (the gesture's own
// limits). Listens on the window, so the stage's pointer capture doesn't hide the lift.
export function useDeskTap(onTap: () => void): void {
  useEffect(() => {
    let start: Sample | null = null;
    const down = (e: PointerEvent) => {
      start = e.isPrimary && onDesk(e.target) ? sample(e) : null;
    };
    const up = (e: PointerEvent) => {
      if (start && isTap(start, sample(e))) onTap();
      start = null;
    };
    const cancel = () => {
      start = null;
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [onTap]);
}
