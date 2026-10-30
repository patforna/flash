import type { Card } from "../../shared/types";
import type { Side } from "../deck/types";
import styles from "./card.module.css";

export interface CardViewProps {
  card: Card;
  side: Side;
  position: number;
  total: number;
  colourOf(topic: string): string;
}

export function CardView({ card, side, colourOf }: CardViewProps) {
  const colours = card.topics.map(colourOf);
  return (
    <div className={styles.frame}>
      <div className={styles.flipper} data-side={side}>
        <div className={styles.face} {...hiddenUnless(side === "front")}>
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
        </div>
        <div className={`${styles.face} ${styles.back}`} {...hiddenUnless(side === "back")} />
      </div>
    </div>
  );
}

// The face turned away takes no input and is hidden from assistive tech.
function hiddenUnless(shown: boolean) {
  return shown ? {} : { inert: true, "aria-hidden": true };
}
