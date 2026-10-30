import type { ReactNode } from "react";
import type { Card } from "../../shared/types";
import type { DeckView } from "../deck/types";
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
  return (
    <div className={styles.stage}>
      {ROLES.map((role) => {
        const card = view[role];
        return (
          <div key={role} className={styles.layer} data-role={role} inert={role !== "current"}>
            <div className={styles.lift}>{card !== null && renderCard(card, role)}</div>
          </div>
        );
      })}
    </div>
  );
}
