import type { OutOfDate } from "./client";

export interface UpdateEnv {
  serviceWorker:
    | (Pick<ServiceWorkerContainer, "addEventListener" | "removeEventListener"> & {
        getRegistration(): Promise<{ installing: unknown; waiting: unknown; update(): Promise<unknown> } | undefined>;
      })
    | undefined;
  storage: Pick<Storage, "getItem" | "setItem">;
  reload: () => void;
}

const KEY = "flash:reloaded-for-a-newer-deck";
const WAIT_MS = 10_000;

// The code that reads a newer deck shipped with it, so after a deploy the way out of OutOfDate is the new code: have
// the worker fetch it (it takes control by itself: skipWaiting, clientsClaim), then reload. Once a session only: a deck
// the new code can't read either (offline with an older deck in the worker's cache) rethrows, for the error card.
// Never settles once it reloads: the page goes, and the stack keeps shuffling until it does.
export async function reloadIntoNewCode(error: OutOfDate, env: UpdateEnv = browser()): Promise<never> {
  try {
    if (env.storage.getItem(KEY)) throw error;
    env.storage.setItem(KEY, "1");
  } catch {
    throw error;
  }
  const registration = await env.serviceWorker?.getRegistration().catch(() => undefined);
  if (env.serviceWorker && registration) {
    const sw = env.serviceWorker;
    const control = new Promise<void>((resolve) => {
      sw.addEventListener("controllerchange", () => resolve(), { once: true });
      setTimeout(resolve, WAIT_MS);
    });
    await registration.update().catch(() => {});
    if (registration.installing || registration.waiting) await control;
  }
  env.reload();
  return new Promise<never>(() => {});
}

function browser(): UpdateEnv {
  return {
    serviceWorker: "serviceWorker" in navigator ? navigator.serviceWorker : undefined,
    storage: storageOrBlocked(),
    reload: () => location.reload(),
  };
}

// Reading sessionStorage itself throws where site data is blocked.
function storageOrBlocked(): Pick<Storage, "getItem" | "setItem"> {
  try {
    return sessionStorage;
  } catch {
    const blocked = () => {
      throw new Error("sessionStorage is blocked");
    };
    return { getItem: blocked, setItem: blocked };
  }
}
