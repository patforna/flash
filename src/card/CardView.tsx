import { useRef } from "react";
import type { Card } from "../../shared/types";
import type { Side } from "../deck/types";
import styles from "./card.module.css";
import { useFit } from "./fit";

// Each face goes through its own type steps: the question's three on the front, the answer's three on the back.
const STEPS = 3;

export interface CardViewProps {
  card: Card;
  side: Side;
}

// An index card: the question alone on the front, the answer alone on the back. Its topics and its place in the pass
// are nowhere on it (the panel and the live region have them): a card is for reading.
export function CardView({ card, side }: CardViewProps) {
  const front = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  useFit(front, STEPS, `${card.id}/front`);
  useFit(back, STEPS, `${card.id}/back`);
  return (
    <div className={styles.frame}>
      <div className={styles.flipper} data-side={side}>
        <div ref={front} className={`${styles.face} ${styles.front}`} {...hiddenUnless(side === "front")}>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the server renders the deck's Markdown through an allowlist of tags */}
          <h2 className={styles.question} dangerouslySetInnerHTML={{ __html: card.questionHtml }} />
        </div>
        <div ref={back} className={`${styles.face} ${styles.back}`} {...hiddenUnless(side === "back")}>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the server renders the deck's Markdown through an allowlist of tags */}
          <div className={styles.answer} dangerouslySetInnerHTML={{ __html: card.answerHtml }} />
        </div>
      </div>
    </div>
  );
}

// The face turned away takes no input and is hidden from assistive tech.
function hiddenUnless(shown: boolean) {
  return shown ? {} : { inert: true, "aria-hidden": true };
}
