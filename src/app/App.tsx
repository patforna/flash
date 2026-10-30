import type { UseQueryResult } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { Deck } from "../../shared/types";
import { useDeckQuery } from "../api/useDeckQuery";
import { CardView } from "../card/CardView";
import { EndCard, endCardText } from "../card/EndCard";
import { FONTS } from "../card/fit";
import { MessageCard, type MessageCardProps } from "../card/MessageCard";
import type { DeckView } from "../deck/types";
import { useDeck } from "../deck/useDeck";
import { Wordmark } from "../desk/Wordmark";
import { colourFor } from "../panel/colours";
import { TopicPanel } from "../panel/TopicPanel";
import { FullscreenChip } from "../platform/FullscreenChip";
import { toggleFullscreen } from "../platform/fullscreen";
import { tick } from "../platform/haptics";
import { useWakeLock } from "../platform/wakeLock";
import { CardStage } from "../stage/CardStage";
import { StillStage } from "../stage/StillStage";
import styles from "./App.module.css";

// A deck that arrives within this long never shows the loading card, so a quick start doesn't flash it.
const LOADING_AFTER_MS = 200;

export function App() {
  useWakeLock();
  const deck = useDeckQuery();
  if (deck.data && deck.data.cards.length > 0) return <Reader deck={deck.data} />;
  return (
    <Desk>
      <Message deck={deck} />
    </Desk>
  );
}

// The desk (docs/plan.md §2): the panel's column, the wordmark at its foot, and the stage beside it.
function Desk({ panel, children }: { panel?: ReactNode; children: ReactNode }) {
  return (
    <main className={styles.shell}>
      <div className={styles.panel}>
        {panel}
        <Wordmark />
      </div>
      {children}
    </main>
  );
}

// The card on the stack while there is nothing to read.
function Message({ deck }: { deck: UseQueryResult<Deck, Error> }) {
  const late = useElapsed(LOADING_AFTER_MS);
  const message = say(deck, late);
  return (
    message && (
      <StillStage>
        <MessageCard {...message} />
      </StillStage>
    )
  );
}

// What that card says, if anything yet.
function say(deck: UseQueryResult<Deck, Error>, late: boolean): MessageCardProps | null {
  // Validation makes an empty deck impossible; should one come, it says so rather than show an end card.
  if (deck.data) return { title: "No cards here." };
  // Tapping the error card asks again (nothing else does: no refetch on focus or reconnect); it shuffles meanwhile.
  if (deck.isError && !deck.isFetching) {
    return {
      title: "Can't reach the deck.",
      hint: "Tap to try again",
      tone: "error",
      onTap: () => void deck.refetch(),
    };
  }
  return late ? { title: "shuffling…" } : null;
}

// Where each layer's card sits in the pass, from the card on top.
const OFFSET = { prev: -1, current: 0, next: 1 } as const;

function Reader({ deck }: { deck: Deck }) {
  const view = useDeck(deck);
  useFirstCardMark();
  const counts = useMemo(() => countTopics(deck), [deck]);
  // A topic's colour is its place in the deck's declared order, the same on its chip and on every card.
  const colourOf = useMemo(() => {
    const place = new Map(deck.topics.map((topic, i) => [topic, i]));
    return (topic: string) => colourFor(place.get(topic) ?? 0);
  }, [deck]);
  return (
    <Desk
      panel={
        <TopicPanel
          topics={deck.topics}
          counts={counts}
          total={deck.cards.length}
          selected={view.selected}
          onToggle={ticked(view.toggleTopic)}
          // All with nothing selected changes nothing, so it doesn't buzz.
          onAll={view.selected.size > 0 ? ticked(view.clearTopics) : view.clearTopics}
          colourOf={colourOf}
          lead={<FullscreenChip />}
        />
      }
    >
      <CardStage
        view={{ ...view, goNext: ticked(view.goNext), goPrev: ticked(view.goPrev), reshuffle: ticked(view.reshuffle) }}
        renderCard={(card, role) =>
          card === "end" ? (
            <EndCard key="end" total={view.total} />
          ) : (
            <CardView
              key={card.id}
              card={card}
              side={role === "current" ? view.side : "front"}
              position={view.position + OFFSET[role]}
              total={view.total}
              colourOf={colourOf}
            />
          )
        }
        onFullscreen={toggleFullscreen}
      />
      {/* The cards remount on every move, so they can't announce it: this region stays and speaks for them. */}
      <p className={styles.announcer} aria-live="polite">
        {whereYouAre(view)}
      </p>
    </Desk>
  );
}

// A change that buzzes: a move as its card lands (the stage moves only then; a tap on the end card deals the next
// pass), or a change of topics. A flip never buzzes.
function ticked<A extends unknown[]>(change: (...args: A) => void): (...args: A) => void {
  return (...args) => {
    tick();
    change(...args);
  };
}

// "Card 7 of 16", or what the end card says.
function whereYouAre(view: DeckView): string {
  if (view.current !== "end") return `Card ${view.position} of ${view.total}`;
  const { title, hint } = endCardText(view.total);
  return `${title} ${hint}`;
}

// How many cards carry each topic: the panel names each chip with its count.
function countTopics({ topics, cards }: Deck): Map<string, number> {
  return new Map(topics.map((topic) => [topic, cards.filter((card) => card.topics.includes(topic)).length]));
}

// The first card is on screen once the fonts it is written in are in (or have failed, leaving the fallback): the
// performance budgets and the screenshots wait for this mark, set once per page load.
const FIRST_CARD = "flash:first-card";

function useFirstCardMark() {
  useEffect(() => {
    const mark = () => {
      if (performance.getEntriesByName(FIRST_CARD, "mark").length === 0) performance.mark(FIRST_CARD);
    };
    Promise.all(FONTS.map((font) => document.fonts.load(font))).then(mark, mark);
  }, []);
}

// True once `ms` have passed since the first render.
function useElapsed(ms: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return elapsed;
}
