import { useEffect } from "react";

// Keeps the screen on while reading: from the first tap or key until idleMs pass without one. The browser drops the
// lock whenever the page is hidden, so one that was held is asked for again when the page is back. Input is heard in
// the capture phase, where no other handler can stop it.
export function useWakeLock(idleMs = 300_000): void {
  useEffect(() => {
    const { wakeLock } = navigator;
    if (!wakeLock) return;
    let lock: Promise<WakeLockSentinel | undefined> | undefined;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const acquire = () => {
      // Refused (battery saver, say): read on without it.
      lock = wakeLock.request("screen").catch(() => undefined);
    };
    const release = () => {
      lock?.then((sentinel) => sentinel?.release());
      lock = undefined;
    };
    const onInput = () => {
      if (!lock) acquire();
      clearTimeout(idle);
      idle = setTimeout(release, idleMs);
    };
    const onVisibilityChange = () => {
      if (lock && document.visibilityState === "visible") acquire();
    };
    window.addEventListener("pointerdown", onInput, true);
    window.addEventListener("keydown", onInput, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pointerdown", onInput, true);
      window.removeEventListener("keydown", onInput, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearTimeout(idle);
      release();
    };
  }, [idleMs]);
}
