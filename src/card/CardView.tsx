import { useRef } from "react";
import type { Card } from "../../shared/types";
import type { Side } from "../deck/types";
import styles from "./card.module.css";
import { useFit } from "./fit";

// Each face goes through its own type steps: the question's three on the front, the answer's three on each sheet of
// the back.
const STEPS = 3;

export interface CardViewProps {
  card: Card;
  side: Side;
  // The page of the back shown (0-based); the front shows with page 0.
  page?: number;
}

// Where a sheet of the back lies against the page shown: in place, peeking below, peeking above, or hidden away.
export type SheetPos = "current" | "next" | "prev" | "away";

const posOf = (n: number, page: number): SheetPos =>
  n === page ? "current" : n === page + 1 ? "next" : n === page - 1 ? "prev" : "away";

// An index card: the question alone on the front, the answer alone on the back, one paper sheet per page, the pages
// clipped behind one another: the next peeks out under the foot, the one before at the head. Its topics and its place
// in the pass are nowhere on it (the panel and the live region have them): a card is for reading. While a back with
// more than one page shows, the frame takes vertical drags itself (data-paged): they turn the pages.
export function CardView({ card, side, page = 0 }: CardViewProps) {
  const front = useRef<HTMLDivElement>(null);
  useFit(front, STEPS, `${card.id}/front`);
  const paged = side === "back" && card.answerPages.length > 1;
  return (
    <div className={styles.frame} data-paged={paged || undefined}>
      <div className={styles.flipper} data-side={side}>
        <div
          ref={front}
          className={`${styles.face} ${styles.paper} ${styles.front}`}
          {...hiddenUnless(side === "front")}
        >
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the server renders the deck's Markdown through an allowlist of tags */}
          <h2 className={styles.question} dangerouslySetInnerHTML={{ __html: card.questionHtml }} />
        </div>
        <div className={`${styles.face} ${styles.back}`} {...hiddenUnless(side === "back")}>
          {card.answerPages.map((html, n) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a page is its place in the answer
            <Sheet key={n} id={card.id} n={n} html={html} pos={posOf(n, page)} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface SheetProps {
  id: string;
  n: number;
  html: string;
  pos: SheetPos;
}

// One page of the back: a sheet of paper with the page's answer on its rules, fitted on its own.
function Sheet({ id, n, html, pos }: SheetProps) {
  const sheet = useRef<HTMLDivElement>(null);
  useFit(sheet, STEPS, `${id}/back/${n}`);
  return (
    <div ref={sheet} className={`${styles.paper} ${styles.sheet}`} data-pos={pos}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the server renders the deck's Markdown through an allowlist of tags */}
      <div className={styles.answer} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// The face turned away takes no input and is hidden from assistive tech.
function hiddenUnless(shown: boolean) {
  return shown ? {} : { inert: true, "aria-hidden": true };
}
