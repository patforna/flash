import { useEffect, useMemo, useState } from "react";
import type { Deck } from "../../shared/types";
import { useDeckQuery } from "../api/useDeckQuery";
import { CardView } from "../card/CardView";
import { EndCard, endCardText } from "../card/EndCard";
import { MessageCard } from "../card/MessageCard";
import type { DeckView } from "../deck/types";
import { useDeck } from "../deck/useDeck";
import { colourFor } from "../panel/colours";
import { TopicPanel } from "../panel/TopicPanel";
import { toggleFullscreen } from "../platform/fullscreen";
import { tick } from "../platform/haptics";
import { CardStage } from "../stage/CardStage";
import styles from "./App.module.css";

// A deck that arrives within this long never shows the loading card, so a quick start doesn't flash it.
const LOADING_AFTER_MS = 200;

export function App() {
  const deck = useDeckQuery();
  const late = useElapsed(LOADING_AFTER_MS);
  if (deck.data) return <Reader deck={deck.data} />;
  // Tapping the error card asks again (nothing else does: no refetch on focus or reconnect); it shuffles meanwhile.
  if (deck.isError && !deck.isFetching) {
    const retry = () => void deck.refetch();
    return <MessageCard title="Can't reach the deck." hint="Tap to try again" tone="error" onTap={retry} />;
  }
  return late ? <MessageCard title="shuffling…" /> : null;
}

// Where each layer's card sits in the pass, from the card on top.
const OFFSET = { prev: -1, current: 0, next: 1 } as const;

function Reader({ deck }: { deck: Deck }) {
  const view = useDeck(deck);
  const counts = useMemo(() => countTopics(deck), [deck]);
  // A topic's colour is its place in the deck's declared order, the same on its chip and on every card.
  const colourOf = useMemo(() => {
    const place = new Map(deck.topics.map((topic, i) => [topic, i]));
    return (topic: string) => colourFor(place.get(topic) ?? 0);
  }, [deck]);
  return (
    <>
      <TopicPanel
        topics={deck.topics}
        counts={counts}
        total={deck.cards.length}
        selected={view.selected}
        onToggle={ticked(view.toggleTopic)}
        // All with nothing selected changes nothing, so it doesn't buzz.
        onAll={view.selected.size > 0 ? ticked(view.clearTopics) : view.clearTopics}
        colourOf={colourOf}
      />
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
    </>
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

// True once `ms` have passed since the first render.
function useElapsed(ms: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return elapsed;
}
