// To do:
// [x] with a service worker: asks it for the new code, waits for the new worker to take control, then reloads
// [x] reloads straight away when no new worker is coming (none installing or waiting after the update)
// [x] reloads after 10 s if the new worker never takes control
// [x] without a service worker (a tab that never installed one): reloads straight away
// [x] reloads at most once a session: the second time it rethrows the error, for the error card
// [x] without session storage it can't know, so it doesn't reload: it rethrows
import { afterEach, describe, expect, test, vi } from "vitest";
import { OutOfDate } from "./client";
import { reloadIntoNewCode, type UpdateEnv } from "./update";

function storage(): Pick<Storage, "getItem" | "setItem"> {
  const items = new Map<string, string>();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) };
}

// A service worker container whose update finds a new worker installing, or none.
function worker({ newWorker }: { newWorker: boolean }) {
  const target = new EventTarget();
  const registration = {
    installing: null as object | null,
    waiting: null,
    update: vi.fn(async () => {
      if (newWorker) registration.installing = {};
    }),
  };
  const container = {
    getRegistration: async () => registration,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  };
  return { container, registration, takeControl: () => target.dispatchEvent(new Event("controllerchange")) };
}

function env(overrides: Partial<UpdateEnv> = {}): UpdateEnv & { reload: ReturnType<typeof vi.fn> } {
  return { serviceWorker: undefined, storage: storage(), reload: vi.fn(), ...overrides } as UpdateEnv & {
    reload: ReturnType<typeof vi.fn>;
  };
}

const error = new OutOfDate("GET /api/cards: a deck this app can't read");
const never = () => new Promise(() => {});

afterEach(() => {
  vi.useRealTimers();
});

describe("reloadIntoNewCode", () => {
  test("asks the service worker for the new code and reloads once the new worker takes control", async () => {
    const { container, registration, takeControl } = worker({ newWorker: true });
    const e = env({ serviceWorker: container });

    void reloadIntoNewCode(error, e);
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalled());
    await Promise.resolve();
    expect(e.reload).not.toHaveBeenCalled();

    takeControl();
    await vi.waitFor(() => expect(e.reload).toHaveBeenCalledTimes(1));
  });

  test("reloads straight away when no new worker is coming", async () => {
    const { container } = worker({ newWorker: false });
    const e = env({ serviceWorker: container });

    void reloadIntoNewCode(error, e);

    await vi.waitFor(() => expect(e.reload).toHaveBeenCalledTimes(1));
  });

  test("reloads after 10 s if the new worker never takes control", async () => {
    vi.useFakeTimers();
    const { container, registration } = worker({ newWorker: true });
    const e = env({ serviceWorker: container });

    void reloadIntoNewCode(error, e);
    // Not vi.waitFor, which moves fake timers on as it polls.
    await vi.advanceTimersByTimeAsync(0);
    expect(registration.update).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(e.reload).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(e.reload).toHaveBeenCalledTimes(1);
  });

  test("without a service worker, reloads straight away, and never settles: the page goes", async () => {
    const e = env();
    const settled = vi.fn();

    void reloadIntoNewCode(error, e).then(settled, settled);

    await vi.waitFor(() => expect(e.reload).toHaveBeenCalledTimes(1));
    await Promise.race([never(), new Promise((resolve) => setTimeout(resolve, 10))]);
    expect(settled).not.toHaveBeenCalled();
  });

  test("reloads at most once a session: the second time it rethrows the error", async () => {
    const e = env();
    void reloadIntoNewCode(error, e);
    await vi.waitFor(() => expect(e.reload).toHaveBeenCalledTimes(1));

    await expect(reloadIntoNewCode(error, e)).rejects.toBe(error);
    expect(e.reload).toHaveBeenCalledTimes(1);
  });

  test("without session storage it doesn't reload, since it couldn't stop at one: it rethrows", async () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const e = env({ storage: throwing });

    await expect(reloadIntoNewCode(error, e)).rejects.toBe(error);
    expect(e.reload).not.toHaveBeenCalled();
  });
});
