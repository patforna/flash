import { type RefObject, useRef } from "react";
import type { Card } from "../../shared/types";
import type { Side } from "../deck/types";
import styles from "./card.module.css";
import { useFit } from "./fit";

// Each face goes through its own type steps: the question's three on the front, each answer page's three on the back.
const STEPS = 3;

export interface CardViewProps {
  card: Card;
  side: Side;
  page: number; // 0-based: the answer page on show
}

// An index card: the question alone on the front, the answer alone on the back, over one to three pages. A tap turns
// the pages (then the card); every page is in the DOM, fitted on its own, and only the one on show is seen or
// reachable. A card with pages counts them in pencil in its corner. Its topics and its place in the pass are nowhere on
// it (the drawer and the live region have them): a card is for reading.
export function CardView({ card, side, page }: CardViewProps) {
  const front = useRef<HTMLDivElement>(null);
  useFit(front, STEPS, `${card.id}/front`);
  const pages = card.answerPages;
  return (
    <div className={styles.frame}>
      <div className={styles.flipper} data-side={side}>
        <div ref={front} className={`${styles.face} ${styles.front}`} {...hiddenUnless(side === "front")}>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the server renders the deck's Markdown through an allowlist of tags */}
          <h2 className={styles.question} dangerouslySetInnerHTML={{ __html: card.questionHtml }} />
        </div>
        <div className={`${styles.face} ${styles.back}`} {...hiddenUnless(side === "back")}>
          {pages.map((html, n) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a card's pages are positional and never reorder
            <Page key={n} fitKey={`${card.id}/back/${n}`} html={html} current={n === page} />
          ))}
          {pages.length > 1 && (
            <span className={styles.count} aria-hidden="true">
              {page + 1}/{pages.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Page({ fitKey, html, current }: { fitKey: string; html: string; current: boolean }) {
  const el: RefObject<HTMLDivElement | null> = useRef(null);
  useFit(el, STEPS, fitKey);
  return (
    <div ref={el} className={styles.page} data-current={current || undefined} {...hiddenUnless(current)}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the server renders the deck's Markdown through an allowlist of tags */}
      <div className={styles.answer} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// The face, or page, turned away takes no input and is hidden from assistive tech.
function hiddenUnless(shown: boolean) {
  return shown ? {} : { inert: true, "aria-hidden": true };
}
