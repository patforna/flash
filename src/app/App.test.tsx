// To do:
// [x] nothing for 200 ms while the deck loads, then a card reading "shuffling…"
// [x] the error card once the deck can't be fetched; tapping it fetches again
// [ ] the empty card for a deck without cards
// [x] the first card of a pass on the stage, front up; the next card underneath, front up too
// [ ] the panel: All with the deck's total, the topics in order with their counts, the wordmark at its foot
// [ ] a chip toggles its topic, All clears the selection
// [ ] colours by the topic's declared index, on the chips and the card
// [x] the end card closes the pass
// [ ] a live region says where you are: "Card 1 of 3", the end card's text
// [ ] haptics on next, previous, reshuffle, the end card's reshuffle and a chip toggle; never on a flip
// [ ] the fullscreen chip leads the panel; f toggles fullscreen
// [ ] the wake lock is asked for on the first input
// [ ] performance mark flash:first-card once the fonts are in and the first card is on screen, once per page load
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
    { id: "what-is-redis", topics: ["Redis"], questionHtml: "What is Redis?", answerHtml: "<p>A cache.</p>" },
    {
      id: "why-cache-postgres",
      topics: ["Postgres", "Redis"],
      questionHtml: "Why cache Postgres?",
      answerHtml: "<p>Fewer reads.</p>",
    },
    { id: "why-queue", topics: ["Queues"], questionHtml: "Why queue work?", answerHtml: "<p>To smooth peaks.</p>" },
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

// Every Web Animation the stage starts, so a move can land at once.
let animations: FakeAnimation[] = [];

// Moves on as the Next button does, landing once the card has flown.
async function goNext() {
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await act(async () => {
    for (const animation of animations) animation.finish();
  });
}

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
});

describe("loading", () => {
  test('shows nothing for 200 ms while the deck loads, then a card reading "shuffling…"', () => {
    vi.useFakeTimers();
    serve(() => new Promise(() => {}));
    renderApp();

    act(() => vi.advanceTimersByTime(199));
    expect(screen.queryByText("shuffling…")).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("shuffling…")).toBeTruthy();
  });
});

describe("an unreachable deck", () => {
  test("shows the error card once every try has failed", async () => {
    const fetchMock = serve(async () => new Response("down", { status: 503 }));
    renderApp();

    expect(await screen.findByRole("button", { name: "Can't reach the deck. Tap to try again" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("tapping the error card fetches again, the loading card showing meanwhile", async () => {
    const fetchMock = serve(async () => new Response("down", { status: 503 }));
    renderApp();
    const retry = await screen.findByRole("button", { name: "Can't reach the deck. Tap to try again" });
    fetchMock.mockImplementation(() => new Promise(() => {}));

    fireEvent.click(retry);

    expect(await screen.findByText("shuffling…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Can't reach the deck. Tap to try again" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("reading", () => {
  test("deals the pass's first card onto the stage, front up, the next one underneath", async () => {
    await reading();

    expect([question(layer("current")), side(layer("current"))]).toEqual(["What is Redis?", "front"]);
    expect([question(layer("next")), side(layer("next"))]).toEqual(["Why cache Postgres?", "front"]);
  });

  test("turning the card over shows its back; the card underneath stays front up", async () => {
    await reading();

    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));

    expect(side(layer("current"))).toBe("back");
    expect(side(layer("next"))).toBe("front");
  });

  test("counts each card's place in the pass on both its faces: 1 / 3 on top, 2 / 3 underneath", async () => {
    await reading();

    expect(within(layer("current")).getAllByText("1 / 3")).toHaveLength(2);
    expect(within(layer("next")).getAllByText("2 / 3")).toHaveLength(2);
  });

  test("closes the pass with the end card, which counts the cards read", async () => {
    await reading();

    for (let i = 0; i < 3; i++) await goNext();

    expect(within(layer("current")).getByText("That's all 3.")).toBeTruthy();
  });
});

describe("topics", () => {
  // The chips in the panel, by their accessible names.
  const chips = () =>
    within(screen.getByRole("group", { name: "Topics" }))
      .getAllByRole("button")
      .map((chip) => chip.getAttribute("aria-label"));
  const chip = (name: string) => within(screen.getByRole("group", { name: "Topics" })).getByRole("button", { name });

  test("the panel offers All with the deck's total, then each topic in the deck's order with its count", async () => {
    await reading();

    expect(chips()).toEqual(["All, 3 cards", "Redis, 2 cards", "Postgres, 1 card", "Queues, 1 card"]);
  });

  test("a topic's chip narrows the pass to its cards; All widens it again, keeping the card on top", async () => {
    await reading();

    fireEvent.click(chip("Queues, 1 card"));
    expect(chip("Queues, 1 card").getAttribute("aria-pressed")).toBe("true");
    expect([question(layer("current")), within(layer("current")).getAllByText("1 / 1").length]).toEqual([
      "Why queue work?",
      2,
    ]);

    fireEvent.click(chip("All, 3 cards"));
    expect(chip("All, 3 cards").getAttribute("aria-pressed")).toBe("true");
    expect([question(layer("current")), within(layer("current")).getAllByText("1 / 3").length]).toEqual([
      "Why queue work?",
      2,
    ]);
  });

  test("colours each topic by its place in the deck, on its chip and on every card carrying it", async () => {
    await reading();

    expect(["Redis, 2 cards", "Postgres, 1 card", "Queues, 1 card"].map((name) => sticker(chip(name)))).toEqual([
      "var(--s-pink)",
      "var(--s-marigold)",
      "var(--s-mint)",
    ]);
    // The card underneath carries Postgres, then Redis: its band in Postgres's colour, a dot in each.
    const front = layer("next").querySelector(`.${cardStyles.face}`);
    expect(front?.querySelector<HTMLElement>(`.${cardStyles.band}`)?.style.backgroundColor).toBe("var(--s-marigold)");
    expect(
      Array.from(front?.querySelectorAll<HTMLElement>(`.${cardStyles.dot}`) ?? [], (dot) => dot.style.backgroundColor),
    ).toEqual(["var(--s-marigold)", "var(--s-pink)"]);
  });
});

const sticker = (chip: HTMLElement) => chip.style.getPropertyValue("--sticker");
