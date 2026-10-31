import { type ReactNode, useEffect, useRef } from "react";
import { Wordmark } from "../desk/Wordmark";
import styles from "./panel.module.css";

export interface TopicDrawerProps {
  open: boolean;
  onClose(): void;
  children: ReactNode;
}

// The topics slide over the desk from the left, a scrim over the cards; a tap on the scrim or Escape closes them.
// Opened, the focus moves to the first selected row (the first topic, with nothing selected: All is dim then); whoever
// opened it takes it back.
// Closed, the drawer is inert: nothing in it can be reached or read.
export function TopicDrawer({ open, onClose, children }: TopicDrawerProps) {
  const aside = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const el = aside.current;
    (
      el?.querySelector<HTMLElement>('[aria-pressed="true"]') ??
      el?.querySelector<HTMLElement>('button:not([aria-disabled="true"])')
    )?.focus();
  }, [open]);

  return (
    <>
      <div className={styles.scrim} data-open={open ? "" : undefined} onClick={onClose} aria-hidden="true" />
      <aside
        ref={aside}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Topics"
        data-open={open ? "" : undefined}
        inert={!open}
      >
        {children}
        <Wordmark />
      </aside>
    </>
  );
}
