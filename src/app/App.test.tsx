// To do:
// [x] the stack from the start, a blank card on top while the deck loads, reading "shuffling…" after 200 ms
// [x] the error card once the deck can't be fetched; tapping it fetches again
// [x] the empty card for a deck without cards
// [x] the first card of a pass on the stage, front up; the next card underneath, front up too
// [x] the first card is dealt onto the stack, after the loading card or within 200 ms
// [x] only the card on top shows the side it was turned to
// [x] the topic drawer (the topics chip, or t): closed and inert until opened, Escape closes it; All with the deck's
//     total, the topics in order with their counts, the wordmark at its foot
// [x] a row toggles its topic; All, never ticked, is dim until something is selected and then clears the selection
// [x] colours by the topic's declared index: the rows' dots, and the chip's dots for the selected topics
// [x] the controls show at launch and stay on the end card
// [x] the end card closes the pass
// [x] a live region says where you are: "Card 1 of 3", "Card 2 of 3, page 2 of 2" on a later page, the end card's text
// [x] a card with pages: the turn button reads "Next page", a tap turns the page, the last page's tap shows the front
// [x] …and, before there is a deck, what the loading and error cards say; the same region once the deck arrives
// [x] haptics as next or previous is decided, on a reshuffle, the end card's reshuffle and a row toggle; never on a
//     flip
// [x] the fullscreen chip is among the controls; f toggles fullscreen; gone fullscreen, the chip is the way out
// [x] the wake lock is asked for on the first input
// [x] performance mark flash:first-card once the fonts are in and the first card is on screen, once per page load;
//     also when a font fails to load
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Deck } from "../../shared/types";
import cardStyles from "../card/card.module.css";
import { FakeAnimation } from "../gesture/testing";
import { App } from "./App";

const deck: Deck = {
  version: "abcdefghijkl",
  topics: ["Redis", "Postgres", "Queues"],
  cards: [
    { id: "what-is-redis", topics: ["Redis"], questionHtml: "What is Redis?", answerPages: ["<p>A cache.</p>"] },
    {
      id: "why-cache-postgres",
      topics: ["Postgres", "Redis"],
      questionHtml: "Why cache Postgres?",
      answerPages: ["<p>Fewer reads.</p>", "<p>And fewer writes to the primary.</p>"],
    },
    { id: "why-queue", topics: ["Queues"], questionHtml: "Why queue work?", answerPages: ["<p>To smooth peaks.</p>"] },
  ],
};

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

// The deck server: every request for the deck gets `answer()`.
function serve(answer: () => Promise<Response>) {
  const fetchMock = vi.fn(answer);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderApp() {
  // No backoff between retries in tests.
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  return render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}

// A shuffle that keeps the file's order: Fisher–Yates swaps each card with itself.
function inFileOrder() {
  vi.spyOn(Math, "random").mockReturnValue(0.999);
}

// The deck served, in file order, and the app showing its first card.
async function reading() {
  inFileOrder();
  serve(async () => json(deck));
  renderApp();
  await waitFor(() => expect(document.querySelector('[data-role="current"] h2')).not.toBeNull());
}

// A layer of the stage (the DOM contract, docs/plan.md §11), the question on its card and the side it shows.
function layer(role: "prev" | "current" | "next"): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-role="${role}"]`);
  if (!el) throw new Error(`no ${role} layer`);
  return el;
}
const question = (el: HTMLElement) => el.querySelector("h2")?.textContent;
const side = (el: HTMLElement) => el.querySelector("[data-side]")?.getAttribute("data-side");

// Text on the card, not its echo in the live region.
const onCard = { ignore: "[aria-live], script, style" };

// Every Web Animation the stage starts, so a move can land at once.
let animations: FakeAnimation[] = [];

// Moves as the Next and Previous buttons do, landing once the card has flown.
async function go(name: "Next" | "Previous") {
  fireEvent.click(screen.getByRole("button", { name }));
  await act(async () => {
    for (const animation of animations) animation.finish();
  });
}
const goNext = () => go("Next");

beforeEach(() => {
  animations = [];
  vi.spyOn(Element.prototype, "animate").mockImplementation(function (this: Element, keyframes, options) {
    const animation = new FakeAnimation(this, keyframes as Keyframe[], options as KeyframeAnimationOptions);
    animations.push(animation);
    return animation as unknown as Animation;
  });
  // happy-dom has no document.fonts: the fonts count as loaded.
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { check: () => true, load: vi.fn(() => Promise.resolve([])) },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "fonts");
  localStorage.clear();
  // The tests share one page load.
  performance.clearMarks("flash:first-card");
});

describe("loading", () => {
  test('the stack is on the desk from the start, a blank card on top, which reads "shuffling…" once 200 ms have passed', () => {
    vi.useFakeTimers();
    serve(() => new Promise(() => {}));
    renderApp();
    const top = () => document.querySelector(`.${cardStyles.message}`)?.textContent;
    expect(document.querySelectorAll("[data-shown]")).toHaveLength(2);
    expect(top()).toBe("");

    act(() => vi.advanceTimersByTime(199));
    expect(top()).toBe("");

    act(() => vi.advanceTimersByTime(1));
    expect(top()).toBe("shuffling…");
  });
});

describe("the live region while there is nothing to read", () => {
  const live = () => document.querySelectorAll("[aria-live]");

  test("is there from the start, empty, and reads out the loading card when it shows", () => {
    vi.useFakeTimers();
    serve(() => new Promise(() => {}));
    renderApp();
    expect([...live()].map((region) => region.textContent)).toEqual([""]);

    act(() => vi.advanceTimersByTime(200));
    expect([...live()].map((region) => region.textContent)).toEqual(["shuffling…"]);
  });

  test("outlives the deck's arrival, so the region that read out the loading card says where you are", async () => {
    inFileOrder();
    serve(() => new Promise((resolve) => setTimeout(() => resolve(json(deck)), 250)));
    renderApp();
    await waitFor(() => expect([...live()].map((region) => region.textContent)).toEqual(["shuffling…"]));
    const region = live()[0];

    await waitFor(() => expect(region?.textContent).toBe("Card 1 of 3"));
    expect([...live()]).toEqual([region]);
  });

  test("reads out the error card once every try has failed", async () => {
    serve(async () => new Response("down", { status: 503 }));
    renderApp();

    await screen.findByRole("button", { name: "Can’t reach the deck. Tap to try again" });
    expect([...live()].map((region) => region.textContent)).toEqual(["Can’t reach the deck. Tap to try again"]);
  });
});

describe("launch", () => {
  const deal = [
    { transform: "translateY(14px)", opacity: 0 },
    { transform: "translateY(0px)", opacity: 1 },
  ];

  test("a deck that comes after the loading card is dealt onto the stack, the card shuffled before it is dealt", async () => {
    inFileOrder();
    serve(() => new Promise((resolve) => setTimeout(() => resolve(json(deck)), 250)));
    renderApp();
    expect(await screen.findByText("shuffling…", onCard)).toBeTruthy();

    await waitFor(() => expect(document.querySelector('[data-role="current"] h2')).not.toBeNull());

    expect(animations.map((a) => [a.el, a.keyframes])).toContainEqual([layer("current"), deal]);
  });

  test("one that comes at once is dealt too, onto the stack that was there from the start", async () => {
    await reading();
    expect(animations.map((a) => [a.el, a.keyframes])).toContainEqual([layer("current"), deal]);
  });
});

describe("an unreachable deck", () => {
  test("shows the error card once every try has failed", async () => {
    const fetchMock = serve(async () => new Response("down", { status: 503 }));
    renderApp();

    expect(await screen.findByRole("button", { name: "Can’t reach the deck. Tap to try again" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("tapping the error card fetches again, the loading card showing meanwhile", async () => {
    const fetchMock = serve(async () => new Response("down", { status: 503 }));
    renderApp();
    const retry = await screen.findByRole("button", { name: "Can’t reach the deck. Tap to try again" });
    fetchMock.mockImplementation(() => new Promise(() => {}));

    fireEvent.click(retry);

    expect(await screen.findByText("shuffling…", onCard)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Can’t reach the deck. Tap to try again" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("an empty deck", () => {
  test('says "No cards here."', async () => {
    serve(async () => json({ ...deck, cards: [] }));
    renderApp();

    expect(await screen.findByText("No cards here.", onCard)).toBeTruthy();
  });
});

describe("reading", () => {
  test("deals the pass's first card onto the stage, front up, the next one underneath", async () => {
    await reading();

    expect([question(layer("current")), side(layer("current"))]).toEqual(["What is Redis?", "front"]);
    expect([question(layer("next")), side(layer("next"))]).toEqual(["Why cache Postgres?", "front"]);
  });

  test("on a card with pages a tap turns the page, the last page's tap turns to the front, the live region counting", async () => {
    await reading();
    await goNext();
    const live = () => document.querySelector("[aria-live]")?.textContent;
    expect(question(layer("current"))).toBe("Why cache Postgres?");

    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(side(layer("current"))).toBe("back");
    expect(layer("current").querySelector("[data-current]")?.textContent).toBe("Fewer reads.");
    expect(live()).toBe("Card 2 of 3");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(layer("current").querySelector("[data-current]")?.textContent).toBe("And fewer writes to the primary.");
    expect(live()).toBe("Card 2 of 3, page 2 of 2");

    fireEvent.click(screen.getByRole("button", { name: "Show question" }));
    expect(side(layer("current"))).toBe("front");
    expect(live()).toBe("Card 2 of 3");
  });

  test("turning the card over shows its back; the card underneath stays front up", async () => {
    await reading();

    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));

    expect(side(layer("current"))).toBe("back");
    expect(side(layer("next"))).toBe("front");
  });

  test("closes the pass with the end card, which counts the cards read", async () => {
    await reading();

    for (let i = 0; i < 3; i++) await goNext();

    expect(within(layer("current")).getByText("That’s all 3.")).toBeTruthy();
  });
});

describe("topics", () => {
  const drawer = () => screen.getByRole("dialog", { name: "Topics", hidden: true });
  const rows = () =>
    within(drawer())
      .getAllByRole("button", { hidden: true })
      .map((row) => row.textContent);
  const row = (name: string) => within(drawer()).getByRole("button", { name, hidden: true });
  const open = () => fireEvent.click(screen.getByRole("button", { name: /^Topics/ }));
  const live = () => document.querySelector("[aria-live]")?.textContent;

  test("the drawer is closed and inert until the topics chip opens it, and Escape closes it again", async () => {
    await reading();
    expect(drawer().hasAttribute("inert")).toBe(true);

    open();
    expect(drawer().hasAttribute("inert")).toBe(false);
    expect(drawer().hasAttribute("data-open")).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(drawer().hasAttribute("inert")).toBe(true);
  });

  test("t opens and closes it too", async () => {
    await reading();
    fireEvent.keyDown(document.body, { key: "t" });
    expect(drawer().hasAttribute("data-open")).toBe(true);
    fireEvent.keyDown(document.body, { key: "t" });
    expect(drawer().hasAttribute("data-open")).toBe(false);
  });

  test("the list offers All with the deck's total, then each topic in the deck's order with its count", async () => {
    await reading();
    open();

    expect(rows()).toEqual(["All 3 cards", "Redis 2 cards", "Postgres 1 card", "Queues 1 card"]);
  });

  test("a topic's row narrows the pass to its cards; All widens it again, keeping the card on top", async () => {
    await reading();
    open();

    fireEvent.click(row("Queues 1 card"));
    expect(row("Queues 1 card").getAttribute("aria-pressed")).toBe("true");
    expect([question(layer("current")), live()]).toEqual(["Why queue work?", "Card 1 of 1"]);

    expect(row("All 3 cards").getAttribute("aria-disabled")).toBe("false");
    fireEvent.click(row("All 3 cards"));
    expect(row("All 3 cards").getAttribute("aria-disabled")).toBe("true");
    expect(row("All 3 cards").getAttribute("aria-pressed")).toBeNull();
    expect([question(layer("current")), live()]).toEqual(["Why queue work?", "Card 1 of 3"]);
  });

  test("the wordmark sits at the foot of the drawer, under the topics", async () => {
    await reading();

    expect(drawer().lastElementChild?.textContent).toBe("flash");
  });

  test("colours each topic's row by its place in the deck, and the chip with the selected topics", async () => {
    await reading();
    open();
    const dot = (name: string) => row(name).querySelector<HTMLElement>("span")?.style.getPropertyValue("--sticker");
    expect(["Redis 2 cards", "Postgres 1 card", "Queues 1 card"].map(dot)).toEqual([
      "var(--s-pink)",
      "var(--s-marigold)",
      "var(--s-mint)",
    ]);

    fireEvent.click(row("Queues 1 card"));

    const chip = screen.getByRole("button", { name: "Topics: Queues" });
    expect(Array.from(chip.querySelectorAll("i"), (d) => d.style.getPropertyValue("--sticker"))).toEqual([
      "var(--s-mint)",
    ]);
  });
});

describe("the controls", () => {
  const revealed = () => document.querySelector("[data-revealed]") !== null;

  test("show at launch", async () => {
    await reading();
    expect(revealed()).toBe(true);
  });

  test("stay on the end card", async () => {
    await reading();
    for (let i = 0; i < 3; i++) await goNext();
    expect(revealed()).toBe(true);
  });
});

describe("announcements", () => {
  const live = () => document.querySelector('[aria-live="polite"]');

  test("one live region says where you are, and stays put as the cards come and go", async () => {
    await reading();
    const region = live();
    expect(region?.textContent).toBe("Card 1 of 3");

    await goNext();

    expect(live()).toBe(region);
    expect(region?.textContent).toBe("Card 2 of 3");
  });

  test("on the end card it reads out the end card", async () => {
    await reading();

    for (let i = 0; i < 3; i++) await goNext();

    expect(live()?.textContent).toBe("That’s all 3. Tap or swipe to shuffle again.");
  });
});

describe("haptics", () => {
  // A phone: a coarse pointer and a vibration motor.
  function phone() {
    vi.spyOn(navigator, "maxTouchPoints", "get").mockReturnValue(5);
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    return vibrate;
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, "vibrate");
  });

  test("an 8 ms tick as each move is decided, before its card has flown, and on a reshuffle; none for a flip", async () => {
    const vibrate = phone();
    await reading();

    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(vibrate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(vibrate.mock.calls).toEqual([[8]]);
    await act(async () => {
      for (const animation of animations) animation.finish();
    });
    expect(vibrate.mock.calls).toEqual([[8]]);
    await go("Previous");
    fireEvent.keyDown(document.body, { key: "s" });

    expect(vibrate.mock.calls).toEqual([[8], [8], [8]]);
  });

  test("a tick as a tap on the end card deals a new pass", async () => {
    const vibrate = phone();
    await reading();
    for (let i = 0; i < 3; i++) await goNext();
    vibrate.mockClear();

    fireEvent.keyDown(document.body, { key: " " });

    expect(question(layer("current"))).not.toBeUndefined();
    expect(vibrate.mock.calls).toEqual([[8]]);
  });

  test("a tick as a row changes the selection; none from All when there is nothing to clear", async () => {
    const vibrate = phone();
    await reading();
    fireEvent.click(screen.getByRole("button", { name: /^Topics/ }));
    const row = (name: string) => within(screen.getByRole("dialog", { name: "Topics" })).getByRole("button", { name });

    fireEvent.click(row("All 3 cards"));
    expect(vibrate).not.toHaveBeenCalled();
    fireEvent.click(row("Redis 2 cards"));
    fireEvent.click(row("All 3 cards"));

    expect(vibrate.mock.calls).toEqual([[8], [8]]);
  });
});

describe("fullscreen", () => {
  // A browser tab that can go fullscreen; happy-dom has no Fullscreen API.
  function fullscreenTab() {
    const request = vi.fn(async () => {});
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: request });
    return request;
  }

  afterEach(() => {
    Reflect.deleteProperty(document, "fullscreenEnabled");
    Reflect.deleteProperty(document, "fullscreenElement");
    Reflect.deleteProperty(document, "exitFullscreen");
    Reflect.deleteProperty(document.documentElement, "requestFullscreen");
  });

  test("in a tab, the fullscreen chip is among the controls and goes fullscreen", async () => {
    const request = fullscreenTab();
    await reading();

    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));

    expect(request).toHaveBeenCalledWith({ navigationUI: "hide" });
  });

  test("gone fullscreen, the chip is the way out", async () => {
    fullscreenTab();
    const exit = vi.fn(async () => {});
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: document.documentElement });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
    await reading();

    expect(screen.queryByRole("button", { name: "Full screen" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));

    expect(exit).toHaveBeenCalled();
  });

  test("f goes fullscreen too", async () => {
    const request = fullscreenTab();
    await reading();

    fireEvent.keyDown(document.body, { key: "f" });

    expect(request).toHaveBeenCalledWith({ navigationUI: "hide" });
  });
});

describe("the wake lock", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "wakeLock");
  });

  test("keeps the screen on from the first touch", async () => {
    const request = vi.fn(async () => ({ release: async () => {} }));
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
    await reading();

    fireEvent.pointerDown(layer("current"));

    expect(request).toHaveBeenCalledWith("screen");
  });
});

describe("the first card's mark", () => {
  const marks = () => performance.getEntriesByName("flash:first-card", "mark").length;

  // Fonts that are still downloading, until `arrive()`.
  function fontsOnTheirWay() {
    let arrive = () => {};
    const loaded = new Promise<FontFace[]>((resolve) => {
      arrive = () => resolve([]);
    });
    Object.defineProperty(document, "fonts", { configurable: true, value: { check: () => false, load: () => loaded } });
    return () => act(async () => arrive());
  }

  test("is set once the fonts are in and the first card is on screen, once per page load", async () => {
    const arrive = fontsOnTheirWay();
    await reading();
    expect(marks()).toBe(0);

    await arrive();
    expect(marks()).toBe(1);

    await goNext();
    renderApp();
    await act(async () => {});
    expect(marks()).toBe(1);
  });

  test("is set even when a font fails to load: the card shows in the fallback", async () => {
    const failed = Promise.reject(new DOMException("A network error occurred.", "NetworkError"));
    failed.catch(() => {});
    Object.defineProperty(document, "fonts", { configurable: true, value: { check: () => false, load: () => failed } });

    await reading();
    await act(async () => {});

    expect(marks()).toBe(1);
  });
});
