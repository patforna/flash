// To do:
// [x] registers the service worker, and asks it for new code at once
// [x] new code taking control before any input: reloads, the launch's re-deal
// [x] new code taking control after the first touch or key: waits, and reloads on the next return to the app
// [x] the first worker taking control of a page that had none is no new code: no reload
// [x] back in the app: asks the worker for new code
// [x] back in the app with a newer deck on the server: reloads, unless a touch came first (then on the next return)
// [x] back in the app with the deck it has, or the server unreachable: nothing
// [x] reloads for a given deck at most once a session: offline-ish, the reload may still get the old deck
// [x] going to the background does nothing
import { describe, expect, test, vi } from "vitest";
import { type FreshEnv, keepFresh } from "./fresh";

function storage(): Pick<Storage, "getItem" | "setItem"> {
  const items = new Map<string, string>();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) };
}

function setup({ controlled = true, latest = "v1" as string | undefined } = {}) {
  const sw = new EventTarget();
  const page = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
  const registration = { update: vi.fn(async () => {}) };
  const env: FreshEnv = {
    serviceWorker: Object.assign(sw, {
      controller: controlled ? {} : null,
      register: vi.fn(async () => registration),
    }),
    document: doc,
    window: page,
    storage: storage(),
    latestDeck: vi.fn(async () => latest),
    deckOnScreen: () => "v1",
    reload: vi.fn(),
  };
  const newCode = () => sw.dispatchEvent(new Event("controllerchange"));
  const touch = () => page.dispatchEvent(new Event("pointerdown"));
  const leave = () => {
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
  };
  const back = async () => {
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(env.latestDeck).toHaveBeenCalled());
    await Promise.resolve();
  };
  return { env, registration, newCode, touch, leave, back };
}

describe("keepFresh", () => {
  test("registers the service worker and asks it for new code at once", async () => {
    const { env, registration } = setup();
    keepFresh(env);
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalledTimes(1));
    expect(env.serviceWorker?.register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  test("reloads when new code takes control before any input", async () => {
    const { env, newCode } = setup();
    keepFresh(env);
    newCode();
    expect(env.reload).toHaveBeenCalledTimes(1);
  });

  test("new code after the first touch waits for the next return to the app", async () => {
    const { env, newCode, touch, leave, back } = setup();
    keepFresh(env);
    touch();
    newCode();
    expect(env.reload).not.toHaveBeenCalled();
    leave();
    expect(env.reload).not.toHaveBeenCalled();
    await back();
    expect(env.reload).toHaveBeenCalledTimes(1);
  });

  test("the first worker taking control of a page that had none is no new code", () => {
    const { env, newCode } = setup({ controlled: false });
    keepFresh(env);
    newCode();
    expect(env.reload).not.toHaveBeenCalled();
  });

  test("back in the app, asks the worker for new code", async () => {
    const { env, registration, touch, leave, back } = setup();
    keepFresh(env);
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalledTimes(1));
    touch();
    leave();
    await back();
    expect(registration.update).toHaveBeenCalledTimes(2);
  });

  test("back in the app with a newer deck on the server, reloads", async () => {
    const { env, touch, leave, back } = setup({ latest: "v2" });
    keepFresh(env);
    touch();
    leave();
    await back();
    await vi.waitFor(() => expect(env.reload).toHaveBeenCalledTimes(1));
  });

  test("a newer deck found after a touch waits for the next return", async () => {
    const { env, touch, leave, back } = setup({ latest: "v2" });
    let answer = (_: string) => {};
    env.latestDeck = vi.fn(() => new Promise<string | undefined>((resolve) => (answer = resolve)));
    keepFresh(env);
    leave();
    await back();
    touch();
    answer("v2");
    await Promise.resolve();
    expect(env.reload).not.toHaveBeenCalled();
    leave();
    await back();
    expect(env.reload).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["the deck it has", "v1"],
    ["the server unreachable", undefined],
  ])("back in the app with %s, does nothing", async (_, latest) => {
    const { env, leave, back } = setup({ latest });
    keepFresh(env);
    leave();
    await back();
    await Promise.resolve();
    expect(env.reload).not.toHaveBeenCalled();
  });

  test("reloads for a given deck at most once a session", async () => {
    const { env, leave, back } = setup({ latest: "v2" });
    keepFresh(env);
    leave();
    await back();
    await vi.waitFor(() => expect(env.reload).toHaveBeenCalledTimes(1));
    // The page after the reload, still holding the old deck (the network was too slow and the worker's copy answered).
    const after = setup({ latest: "v2" });
    after.env.storage = env.storage;
    keepFresh(after.env);
    after.leave();
    await after.back();
    await Promise.resolve();
    expect(after.env.reload).not.toHaveBeenCalled();
  });

  test("going to the background does nothing", async () => {
    const { env, registration, leave } = setup({ latest: "v2" });
    keepFresh(env);
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalledTimes(1));
    leave();
    await Promise.resolve();
    expect(env.latestDeck).not.toHaveBeenCalled();
    expect(registration.update).toHaveBeenCalledTimes(1);
  });
});
