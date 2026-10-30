import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";
import type { Card } from "../../shared/types";
import { useShortcuts } from "../app/useShortcuts";
import type { DeckView } from "../deck/types";
import { useSwipe } from "../gesture/useSwipe";
import styles from "./stage.module.css";

type Role = "prev" | "current" | "next";

export interface CardStageProps {
  view: DeckView;
  renderCard(card: Card | "end", role: Role): ReactNode;
  onFullscreen(): void;
  // A move is decided, before its card has flown: a swipe let go past its threshold, a key, a button, or a tap on the
  // end card (which deals the next pass).
  onMove(): void;
}

// Painted in this order: the previous card comes back over the current one, which lies over the next.
const ROLES = ["next", "current", "prev"] as const;

const keyOf = (card: Card | "end") => (card === "end" ? "end" : card.id);
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
// A CSS time in ms, whichever unit it is written in: the build's minifier turns 380ms into .38s.
const ms = (time: string) => Number.parseFloat(time) * (/ms\s*$/.test(time) ? 1 : 1000) || 0;

export function CardStage({ view, renderCard, onFullscreen, onMove }: CardStageProps) {
  const stage = useRef<HTMLDivElement>(null);
  const layers = useRef<Record<Role, HTMLDivElement | null>>({ next: null, current: null, prev: null });

  // The card a commit lands on: arriving by a swipe, it isn't dealt.
  const landing = useRef<string | null>(null);
  const swipe = useSwipe(stage, {
    layers: () => {
      const { current, next, prev } = layers.current;
      return current && { current, next: view.next && next, prev: view.prev && prev };
    },
    can: () => ({ prev: view.prev !== null, next: view.next !== null || view.current === "end" }),
    // The end card has no back: a tap deals the next pass.
    onTap: () => {
      if (view.current !== "end") return view.flip();
      onMove();
      view.goNext();
    },
    onDecide: onMove,
    onCommit: (dir) => {
      const to = view[dir];
      landing.current = to && keyOf(to);
      if (dir === "next") view.goNext();
      else view.goPrev();
    },
    reducedMotion,
  });

  useShortcuts({
    flip: swipe.tap,
    next: () => swipe.commit("next"),
    prev: () => swipe.commit("prev"),
    reshuffle: () => view.reshuffle(),
    fullscreen: onFullscreen,
  });

  // While a flip runs (data-flipping), the card underneath shows blank paper: edge-on, the flipping card hides little.
  // It runs from a change of side until the flipper's transform transition ends, or for the flip's duration (a token;
  // under reduced motion the faces cross-fade and no transform ends).
  const flipEnd = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stopFlip = () => {
    clearTimeout(flipEnd.current);
    stage.current?.removeAttribute("data-flipping");
  };
  const shown = useRef({ key: keyOf(view.current), side: view.side });
  useLayoutEffect(() => {
    const key = keyOf(view.current);
    const el = stage.current;
    if (key !== shown.current.key) {
      stopFlip();
      if (key !== landing.current) swipe.deal();
    } else if (el && view.side !== shown.current.side) {
      el.setAttribute("data-flipping", "");
      clearTimeout(flipEnd.current);
      const duration = getComputedStyle(el).getPropertyValue(
        reducedMotion() ? "--flip-fade-duration" : "--flip-duration",
      );
      flipEnd.current = setTimeout(stopFlip, ms(duration));
    }
    shown.current = { key, side: view.side };
    landing.current = null;
  });
  useEffect(() => {
    return () => clearTimeout(flipEnd.current);
  }, []);

  // The stack thins as the pass runs out: the cards after the current one, beyond the one underneath it.
  const remaining = view.total - view.position;
  return (
    <div
      ref={stage}
      className={styles.stage}
      onTransitionEnd={(e) => {
        // The flipper is the card's [data-side] element (docs/plan.md §11).
        if (e.propertyName === "transform" && e.target instanceof Element && e.target.matches("[data-side]")) {
          stopFlip();
        }
      }}
    >
      <div className={styles.box}>
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
        <button
          type="button"
          className={styles.prev}
          aria-label="Previous"
          disabled={view.prev === null}
          onClick={() => swipe.commit("prev")}
        >
          ‹
        </button>
        {view.current !== "end" && (
          <button type="button" className={styles.flip} onClick={swipe.tap}>
            {view.side === "front" ? "Show answer" : "Show question"}
          </button>
        )}
        <button type="button" className={styles.next} aria-label="Next" onClick={() => swipe.commit("next")}>
          ›
        </button>
      </div>
    </div>
  );
}
