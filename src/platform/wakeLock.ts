import { useEffect } from "react";

export function useWakeLock(_idleMs = 300_000): void {
  useEffect(() => {
    const { wakeLock } = navigator;
    if (!wakeLock) return;
    const onInput = () => {
      wakeLock.request("screen");
    };
    window.addEventListener("pointerdown", onInput, true);
    return () => {
      window.removeEventListener("pointerdown", onInput, true);
    };
  }, []);
}
