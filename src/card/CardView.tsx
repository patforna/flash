import { type CSSProperties, useLayoutEffect, useRef } from "react";
import type { Card } from "../../shared/types";
import type { Side } from "../deck/types";
import styles from "./card.module.css";
import { useFit } from "./fit";
import { tiltFor } from "./tilt";

// Each face goes through its own type steps: the question's three on the front, the answer's three on the back.
const STEPS = 3;

export interface CardViewProps {
  card: Card;
  side: Side;
}

// An index card: the question alone on the front, the answer alone on the back. Its topics and its place in the pass
// are nowhere on it (the panel and the live region have them): a card is for reading. The question is written at the
// card's own slant (tiltFor), so the fronts don't all lie dead level.
// An answer of several pages is one column that scrolls, the pages following one another after a break (an hr the
// stylesheet turns into one empty ruled line); such a back keeps the largest type (useFit pins it) and a grey
// highlighter arrow in the corner says there is more, until the end is reached. Its scroll starts at the top each time the card is turned
// to its back.
export function CardView({ card, side }: CardViewProps) {
  const front = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const answer = useRef<HTMLDivElement>(null);
  const pages = card.answerPages.length;
  useFit(front, STEPS, `${card.id}/front`);
  useFit(back, STEPS, `${card.id}/back`, pages > 1);
  useLayoutEffect(() => {
    if (side === "back" && pages > 1) answer.current?.scrollTo(0, 0);
  }, [side, pages]);
  return (
    <div className={styles.frame}>
      <div className={styles.flipper} data-side={side}>
        <div ref={front} className={`${styles.face} ${styles.front}`} {...hiddenUnless(side === "front")}>
          <h2
            className={styles.question}
            style={{ "--tilt": `${tiltFor(card.id)}deg` } as CSSProperties}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: the server renders the deck's Markdown through an allowlist of tags
            dangerouslySetInnerHTML={{ __html: card.questionHtml }}
          />
        </div>
        <div
          ref={back}
          className={`${styles.face} ${styles.back}`}
          data-pages={pages > 1 ? pages : undefined}
          {...hiddenUnless(side === "back")}
        >
          <div
            ref={answer}
            className={styles.answer}
            data-scroll={pages > 1 ? "" : undefined}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: the server renders the deck's Markdown through an allowlist of tags
            dangerouslySetInnerHTML={{ __html: card.answerPages.join("<hr>") }}
          />
          {pages > 1 && (
            // Two chisel strokes, as the end card's tick: the shaft, then the head, darker where they cross.
            <svg className={styles.more} viewBox="0 0 22 30" aria-hidden="true">
              <path d="M10 1.4 L12.6 1.8 L12.2 24.2 L9.8 23.6 Z" />
              <path d="M3 16.2 L5.6 15 L11.2 23.4 L16.6 13.4 L19 14.8 L11.4 27.8 Z" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

// The face turned away takes no input and is hidden from assistive tech.
function hiddenUnless(shown: boolean) {
  return shown ? {} : { inert: true, "aria-hidden": true };
}
