import { useCallback, useEffect, useRef, useState } from "react";

// Shows the desk's controls for a moment: reveal() shows them and arms the timer that hides them `ms` later (from now
// again, if they are already shown); hide() hides them at once.
export function useReveal(ms = 3000): { shown: boolean; reveal(): void; hide(): void } {
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setShown(false);
  }, []);
  const reveal = useCallback(() => {
    clearTimeout(timer.current);
    setShown(true);
    timer.current = setTimeout(() => setShown(false), ms);
  }, [ms]);
  useEffect(() => {
    return () => clearTimeout(timer.current);
  }, []);
  return { shown, reveal, hide };
}
