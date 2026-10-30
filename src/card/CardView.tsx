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
  position: number;
  total: number;
  colourOf(topic: string): string;
}

export function CardView({ card, side, position, total, colourOf }: CardViewProps) {
  const front = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  useFit(front, STEPS, `${card.id}/front`);
  useFit(back, STEPS, `${card.id}/back`);
  const colours = card.topics.map(colourOf);
  return (
    <div className={styles.frame}>
      <div className={styles.flipper} data-side={side}>
        <div ref={front} className={styles.face} {...hiddenUnless(side === "front")}>
          <div className={styles.band} style={{ backgroundColor: colours[0] }} />
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the server renders the deck's Markdown through an allowlist of tags */}
          <h2 className={styles.question} dangerouslySetInnerHTML={{ __html: card.questionHtml }} />
          <ul className={styles.topics}>
            {card.topics.map((topic, i) => (
              <li key={topic}>
                <span className={styles.dot} style={{ backgroundColor: colours[i] }} />
                {topic}
              </li>
            ))}
          </ul>
          <Counter position={position} total={total} />
        </div>
        <div ref={back} className={`${styles.face} ${styles.back}`} {...hiddenUnless(side === "back")}>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the server renders the deck's Markdown through an allowlist of tags */}
          <h2 className={styles.header} dangerouslySetInnerHTML={{ __html: card.questionHtml }} />
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the server renders the deck's Markdown through an allowlist of tags */}
          <div className={styles.answer} dangerouslySetInnerHTML={{ __html: card.answerHtml }} />
          <Counter position={position} total={total} />
        </div>
      </div>
    </div>
  );
}

// "07 / 16": the position padded to the total's width, so the digits never shift as you read on. Not a live region:
// the card mounts with it on every move, which a screen reader wouldn't announce; the app has one that does.
function Counter({ position, total }: { position: number; total: number }) {
  return (
    <p className={styles.counter}>
      {String(position).padStart(String(total).length, "0")} / {total}
    </p>
  );
}

// The face turned away takes no input and is hidden from assistive tech.
function hiddenUnless(shown: boolean) {
  return shown ? {} : { inert: true, "aria-hidden": true };
}
