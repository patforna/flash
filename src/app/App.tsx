import { useEffect, useState } from "react";
import { MessageCard } from "../card/MessageCard";

// A deck that arrives within this long never shows the loading card, so a quick start doesn't flash it.
const LOADING_AFTER_MS = 200;

export function App() {
  const late = useElapsed(LOADING_AFTER_MS);
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
