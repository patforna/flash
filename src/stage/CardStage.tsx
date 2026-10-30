import { type ReactNode, useLayoutEffect, useRef } from "react";
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

const keyOf = (card: Card | "end") => (card === "end" ? "end" : card.id);

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

  // While a flip runs, the card underneath shows blank paper (data-flipping): edge-on, the flipping card hides little.
  const shown = useRef({ key: keyOf(view.current), side: view.side });
  useLayoutEffect(() => {
    const key = keyOf(view.current);
    if (key === shown.current.key && view.side !== shown.current.side) stage.current?.setAttribute("data-flipping", "");
    shown.current = { key, side: view.side };
  });

  // The stack thins as the pass runs out: the cards after the current one, beyond the one underneath it.
  const remaining = view.total - view.position;
  return (
    <div
      ref={stage}
      className={styles.stage}
      onTransitionEnd={(e) => {
        if (e.propertyName === "transform" && e.target instanceof Element && e.target.matches("[data-side]")) {
          stage.current?.removeAttribute("data-flipping");
        }
      }}
    >
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
