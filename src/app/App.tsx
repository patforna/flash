import { useEffect, useState } from "react";
import type { Deck } from "../../shared/types";
import { useDeckQuery } from "../api/useDeckQuery";
import { CardView } from "../card/CardView";
import { MessageCard } from "../card/MessageCard";
import { useDeck } from "../deck/useDeck";
import { toggleFullscreen } from "../platform/fullscreen";
import { CardStage } from "../stage/CardStage";

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

function Reader({ deck }: { deck: Deck }) {
  const view = useDeck(deck);
  return (
    <CardStage
      view={view}
      renderCard={(card) =>
        card === "end" ? null : (
          <CardView
            key={card.id}
            card={card}
            side="front"
            position={view.position}
            total={view.total}
            colourOf={() => ""}
          />
        )
      }
      onFullscreen={toggleFullscreen}
    />
  );
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
