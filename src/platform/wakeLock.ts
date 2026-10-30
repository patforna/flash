import { useEffect } from "react";

export function useWakeLock(idleMs = 300_000): void {
  useEffect(() => {
    const { wakeLock } = navigator;
    if (!wakeLock) return;
    let lock: Promise<WakeLockSentinel> | undefined;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const release = () => {
      lock?.then((sentinel) => sentinel.release());
    };
    const onInput = () => {
      lock ??= wakeLock.request("screen");
      clearTimeout(idle);
      idle = setTimeout(release, idleMs);
    };
    window.addEventListener("pointerdown", onInput, true);
    window.addEventListener("keydown", onInput, true);
    return () => {
      window.removeEventListener("pointerdown", onInput, true);
      window.removeEventListener("keydown", onInput, true);
    };
  }, [idleMs]);
}
