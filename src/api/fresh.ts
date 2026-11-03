import { storageOrBlocked } from "./update";

// Keeps the app on the newest code and deck without ever changing a card under the reader. The service worker starts
// the app from its precache, so a launch runs the code it last stored while the new code installs behind it; and on
// Android, coming back to the app resumes the page, which checks for nothing. So the app asks at launch and on every
// return: the worker for new code (it takes control by itself: skipWaiting, clientsClaim), the server for the deck's
// version. Anything new is applied by a reload, the launch's own re-deal, at once if it lands before the first touch or
// key since the launch or return, otherwise on the next return to the app.
export interface FreshEnv {
  serviceWorker:
    | (Pick<ServiceWorkerContainer, "addEventListener"> & {
        controller: unknown;
        register(url: string, options: RegistrationOptions): Promise<{ update(): Promise<unknown> }>;
      })
    | undefined;
  document: Pick<Document, "visibilityState" | "addEventListener">;
  window: Pick<Window, "addEventListener">;
  storage: Pick<Storage, "getItem" | "setItem">;
  // The deck's version on the server (what /healthz reports), or undefined if it can't be reached.
  latestDeck(): Promise<string | undefined>;
  // The version of the deck the app is showing, once it has one.
  deckOnScreen(): string | undefined;
  reload(): void;
}

const KEY = "flash:reloaded-for-deck";

export function keepFresh(env: FreshEnv): void {
  let quiet = true;
  let stale = false;
  const outdated = () => {
    stale = true;
    if (quiet) env.reload();
  };

  const sw = env.serviceWorker;
  const registration = sw?.register("/sw.js", { scope: "/" }).catch(() => undefined);
  const askForCode = () => void registration?.then((r) => r?.update()).catch(() => {});
  if (sw) {
    // On a first visit the worker takes control of a page that had none: that is no new code.
    const hadController = sw.controller != null;
    sw.addEventListener("controllerchange", () => {
      if (hadController) outdated();
    });
  }
  askForCode();

  const askForDeck = async () => {
    const latest = await env.latestDeck().catch(() => undefined);
    const shown = env.deckOnScreen();
    if (!latest || !shown || latest === shown || reloadedFor(env.storage, latest)) return;
    outdated();
  };

  for (const type of ["pointerdown", "keydown"]) {
    env.window.addEventListener(type, () => (quiet = false), { capture: true, passive: true });
  }
  env.document.addEventListener("visibilitychange", () => {
    if (env.document.visibilityState !== "visible") return;
    quiet = true;
    askForCode();
    void askForDeck();
    if (stale) env.reload();
  });
}

// Marks the deck as reloaded for, once a session: a reload whose deck came from the worker's copy (the network too
// slow) still shows the old one, and must not reload again on every return. Without session storage, never reloads.
function reloadedFor(storage: FreshEnv["storage"], version: string): boolean {
  try {
    if (storage.getItem(KEY) === version) return true;
    storage.setItem(KEY, version);
    return false;
  } catch {
    return true;
  }
}

// The browser's own, given how to read the deck the app is showing.
export function browserEnv(deckOnScreen: FreshEnv["deckOnScreen"]): FreshEnv {
  return {
    serviceWorker: "serviceWorker" in navigator ? navigator.serviceWorker : undefined,
    document,
    window,
    storage: storageOrBlocked(),
    latestDeck: async () => {
      const res = await fetch("/healthz", { cache: "no-store" });
      return res.ok ? ((await res.json()) as { version?: string }).version : undefined;
    },
    deckOnScreen,
    reload: () => location.reload(),
  };
}
