import { useEffect } from "react";

interface Handlers {
  flip(): void;
  next(): void;
  prev(): void;
  reshuffle(): void;
  fullscreen(): void;
}

export function useShortcuts(h: Handlers): void {
  useEffect(() => {
    const onKey = () => h.flip();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}
