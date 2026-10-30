import { useEffect } from "react";

export function useWakeLock(idleMs = 300_000): void {
  useEffect(() => {
    const { wakeLock } = navigator;
    if (!wakeLock) return;
    let lock: Promise<WakeLockSentinel | undefined> | undefined;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const acquire = () => {
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
