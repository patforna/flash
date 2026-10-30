import { type ReactNode, useRef } from "react";
import type { Card } from "../../shared/types";
import type { DeckView } from "../deck/types";
import { useSwipe } from "../gesture/useSwipe";
import styles from "./stage.module.css";

type Role = "prev" | "current" | "next";

export interface CardStageProps {
  view: DeckView;
  renderCard(card: Card | "end", role: Role): ReactNode;
  onFullscreen(): void;
}

// Painted in this order: the previous card comes back over the current one, which lies over the next.
const ROLES = ["next", "current", "prev"] as const;

export function CardStage({ view, renderCard }: CardStageProps) {
  const stage = useRef<HTMLDivElement>(null);
  const layers = useRef<Record<Role, HTMLDivElement | null>>({ next: null, current: null, prev: null });

  useSwipe(stage, {
    layers: () => {
      const { current, next, prev } = layers.current;
      return current && { current, next: view.next && next, prev: view.prev && prev };
    },
    can: () => ({ prev: view.prev !== null, next: view.next !== null || view.current === "end" }),
    // The end card has no back: a tap deals the next pass.
    onTap: () => (view.current === "end" ? view.goNext() : view.flip()),
    onCommit: (dir) => (dir === "next" ? view.goNext() : view.goPrev()),
    reducedMotion: () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  });

  // The stack thins as the pass runs out: the cards after the current one, beyond the one underneath it.
  const remaining = view.total - view.position;
  return (
    <div ref={stage} className={styles.stage}>
      <div className={styles.blank} data-shown={remaining >= 3 || undefined} />
      <div className={styles.blank} data-shown={remaining >= 2 || undefined} />
      {ROLES.map((role) => {
        const card = view[role];
        return (
          <div
            key={role}
            ref={(el) => {
              layers.current[role] = el;
            }}
            className={styles.layer}
            data-role={role}
            inert={role !== "current"}
          >
            <div className={styles.lift}>{card !== null && renderCard(card, role)}</div>
          </div>
        );
      })}
    </div>
  );
}
