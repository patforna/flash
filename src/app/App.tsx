import type { UseQueryResult } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  const late = useElapsed(LOADING_AFTER_MS);
  // The app's one live region, rendered once and empty at first: a region that mounts with its text isn't read out,
  // and the stage changes when the deck arrives. Whatever the desk shows writes into it.
  const [live, setLive] = useState<HTMLElement | null>(null);
  const reading = deck.data && deck.data.cards.length > 0;
  return (
    <main className={styles.shell}>
      {/* After the loading card, the first card is dealt onto the stack: shuffling, then dealing. */}
      {reading ? <Reader deck={deck.data} dealt={late} live={live} /> : <Waiting deck={deck} late={late} live={live} />}
      <p ref={setLive} className={styles.announcer} aria-live="polite" />
    </main>
  );
}

// The card on the stack while there is nothing to read, read out as it shows.
function Waiting({ deck, late, live }: { deck: UseQueryResult<Deck, Error>; late: boolean; live: HTMLElement | null }) {
  const message = say(deck, late);
  return (
    <Desk live={live} announce={message ? [message.title, message.hint].filter(Boolean).join(" ") : ""}>
      {message && (
        <StillStage>
          <MessageCard {...message} />
        </StillStage>
      )}
    </Desk>
  );
}

interface DeskProps {
  panel?: ReactNode;
  live: HTMLElement | null;
  announce: string;
  children: ReactNode;
}

// The desk (docs/plan.md §2): the panel's column, the wordmark at its foot, and the stage beside it. `announce` is read
// out through the live region, `live`, as it changes.
function Desk({ panel, live, announce, children }: DeskProps) {
  return (
    <>
      <div className={styles.panel}>
        {panel}
        <Wordmark />
      </div>
      {children}
      {live && createPortal(announce, live)}
    </>
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

function Reader({ deck, dealt, live }: { deck: Deck; dealt: boolean; live: HTMLElement | null }) {
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
      live={live}
      announce={whereYouAre(view)}
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
        view={{ ...view, reshuffle: ticked(view.reshuffle) }}
        onMove={() => tick()}
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
        dealFirst={dealt}
      />
    </Desk>
  );
}

// A change that buzzes at once: a reshuffle, or a change of topics. The stage buzzes a move as it is decided (onMove),
// before its card has flown. A flip never buzzes.
function ticked<A extends unknown[]>(change: (...args: A) => void): (...args: A) => void {
  return (...args) => {
    tick();
    change(...args);
  };
}

// "Card 7 of 16", or what the end card says. The cards remount on every move, so they can't announce it themselves.
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
