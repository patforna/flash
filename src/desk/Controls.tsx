import type { FocusEvent, ReactNode } from "react";
import styles from "./desk.module.css";

export interface ControlsProps {
  revealed: boolean;
  // The focus has come into the controls (true) or left them (false): a keyboard reveals them as it reaches them.
  onFocusWithin?(within: boolean): void;
  children: ReactNode;
}

// The desk's controls, in a column along the card's left edge: shown while `revealed` or while one of them has the
// focus, faded out otherwise and then out of a tap's reach, so a blind tap in the corner does nothing.
export function Controls({ revealed, onFocusWithin, children }: ControlsProps) {
  const left = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) onFocusWithin?.(false);
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: focus events only, to know when a control has the focus
    <div
      className={styles.controls}
      data-revealed={revealed || undefined}
      onFocus={() => onFocusWithin?.(true)}
      onBlur={left}
    >
      {children}
    </div>
  );
}
