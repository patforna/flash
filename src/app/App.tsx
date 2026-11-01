import type { UseQueryResult } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Deck } from "../../shared/types";
import { useDeckQuery } from "../api/useDeckQuery";
import { CardView } from "../card/CardView";
import { EndCard, endCardText } from "../card/EndCard";
import { FONTS } from "../card/fit";
import { MessageCard, type MessageCardProps } from "../card/MessageCard";
import type { DeckView } from "../deck/types";
import { useDeck } from "../deck/useDeck";
import { Controls } from "../desk/Controls";
import { TopicsChip } from "../desk/TopicsChip";
import { colourFor } from "../panel/colours";
import { TopicDrawer } from "../panel/TopicDrawer";
import { TopicList } from "../panel/TopicList";
import { FullscreenChip } from "../platform/FullscreenChip";
import { toggleFullscreen } from "../platform/fullscreen";
import { tick } from "../platform/haptics";
import { useWakeLock } from "../platform/wakeLock";
import { CardStage } from "../stage/CardStage";
import { StillStage } from "../stage/StillStage";
import styles from "./App.module.css";
import { useDeskTap } from "./useDeskTap";
import { useReveal } from "./useReveal";

// A deck that arrives within this long never shows "shuffling…", so a quick start doesn't flash it.
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
      {reading ? <Reader deck={deck.data} live={live} /> : <Waiting deck={deck} late={late} live={live} />}
      <p ref={setLive} className={styles.announcer} aria-live="polite" />
    </main>
  );
}

// The stack is on the desk from the first frame, with a card on top that says why there is nothing to read yet, read
// out as it shows. The one control is the way in or out of fullscreen, shown throughout: there is nothing to read yet.
function Waiting({ deck, late, live }: { deck: UseQueryResult<Deck, Error>; late: boolean; live: HTMLElement | null }) {
  const message = say(deck, late);
  return (
    <Desk
      live={live}
      announce={[message.title, message.hint].filter(Boolean).join(" ")}
      controls={
        <Controls revealed>
          <FullscreenChip />
        </Controls>
      }
    >
      <StillStage>
        <MessageCard {...message} />
      </StillStage>
    </Desk>
  );
}

interface DeskProps {
  controls: ReactNode;
  drawer?: ReactNode;
  live: HTMLElement | null;
  announce: string;
  children: ReactNode;
}

// The desk (docs/plan.md §2): the controls along the card's left edge, the stage, and the topic drawer over them.
// `announce` is read out through the live region, `live`, as it changes.
function Desk({ controls, drawer, live, announce, children }: DeskProps) {
  return (
    <>
      {controls}
      {children}
      {drawer}
      {live && createPortal(announce, live)}
    </>
  );
}

// What that card says: nothing while the deck is on time.
function say(deck: UseQueryResult<Deck, Error>, late: boolean): MessageCardProps {
  // Validation makes an empty deck impossible; should one come, it says so rather than show an end card.
  if (deck.data) return { title: "No cards here." };
  // Tapping the error card asks again (nothing else does: no refetch on focus or reconnect); it shuffles meanwhile.
  if (deck.isError && !deck.isFetching) {
    return {
      title: "Can’t reach the deck.",
      hint: "Tap to try again",
      tone: "error",
      onTap: () => void deck.refetch(),
    };
  }
  return { title: late ? "shuffling…" : "" };
}

// The first card is dealt onto the stack that was there while the deck was on its way: shuffling, then dealing.
function Reader({ deck, live }: { deck: Deck; live: HTMLElement | null }) {
  const view = useDeck(deck);
  useFirstCardMark();
  const counts = useMemo(() => countTopics(deck), [deck]);
  // A topic's colour is its place in the deck's declared order, the same in the list and on the chip.
  const colourOf = useMemo(() => {
    const place = new Map(deck.topics.map((topic, i) => [topic, i]));
    return (topic: string) => colourFor(place.get(topic) ?? 0);
  }, [deck]);
  const selected = useMemo(() => deck.topics.filter((topic) => view.selected.has(topic)), [deck, view.selected]);

  // The controls show for a moment at launch and after a tap on the desk, stay while the drawer is open or the end
  // card is up (the moment to change topics), and go as a card moves. A control taking the focus shows them too.
  const { shown, reveal, hide } = useReveal();
  useEffect(() => {
    reveal();
  }, [reveal]);
  useDeskTap(reveal);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const chip = useRef<HTMLButtonElement>(null);
  // Closing hands the focus back to the chip: a keyboard keeps the controls in sight from there.
  const closeTopics = useCallback(() => {
    setTopicsOpen(false);
    chip.current?.focus();
  }, []);
  const toggleTopics = useCallback(() => {
    if (topicsOpen) closeTopics();
    else setTopicsOpen(true);
  }, [topicsOpen, closeTopics]);
  const revealed = shown || topicsOpen || view.current === "end";

  return (
    <Desk
      live={live}
      announce={whereYouAre(view)}
      controls={
        <Controls revealed={revealed} onFocusWithin={(within) => within && reveal()}>
          <FullscreenChip />
          <TopicsChip ref={chip} selected={selected} colourOf={colourOf} open={topicsOpen} onClick={toggleTopics} />
        </Controls>
      }
      drawer={
        <TopicDrawer open={topicsOpen} onClose={closeTopics}>
          <TopicList
            topics={deck.topics}
            counts={counts}
            total={deck.cards.length}
            selected={view.selected}
            onToggle={ticked(view.toggleTopic)}
            // All with nothing selected changes nothing, so it doesn't buzz.
            onAll={view.selected.size > 0 ? ticked(view.clearTopics) : view.clearTopics}
            colourOf={colourOf}
          />
        </TopicDrawer>
      }
    >
      <CardStage
        view={{ ...view, reshuffle: ticked(view.reshuffle) }}
        onMove={() => {
          tick();
          hide();
        }}
        renderCard={(card, role) =>
          card === "end" ? (
            <EndCard key="end" total={view.total} />
          ) : (
            <CardView
              key={card.id}
              card={card}
              side={role === "current" ? view.side : "front"}
              page={role === "current" ? view.page : 0}
            />
          )
        }
        onFullscreen={toggleFullscreen}
        onTopics={toggleTopics}
        dealFirst
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

// How many cards carry each topic: the list shows each row's count and names it.
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
