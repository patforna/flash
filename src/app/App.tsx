import { useEffect, useState } from "react";
import { useDeckQuery } from "../api/useDeckQuery";
import { MessageCard } from "../card/MessageCard";

// A deck that arrives within this long never shows the loading card, so a quick start doesn't flash it.
const LOADING_AFTER_MS = 200;

export function App() {
  const deck = useDeckQuery();
  const late = useElapsed(LOADING_AFTER_MS);
  // Tapping the error card asks again (nothing else does: no refetch on focus or reconnect); it shuffles meanwhile.
  if (deck.isError && !deck.isFetching) {
    const retry = () => void deck.refetch();
    return <MessageCard title="Can't reach the deck." hint="Tap to try again" tone="error" onTap={retry} />;
  }
  return late ? <MessageCard title="shuffling…" /> : null;
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
