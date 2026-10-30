// To do:
// [x] nothing for 200 ms while the deck loads, then a card reading "shuffling…"
// [x] the error card once the deck can't be fetched; tapping it fetches again
// [ ] the empty card for a deck without cards
// [ ] the first card of a pass on the stage, front up; the next card underneath, front up too
// [ ] the panel: All with the deck's total, the topics in order with their counts, the wordmark at its foot
// [ ] a chip toggles its topic, All clears the selection
// [ ] colours by the topic's declared index, on the chips and the card
// [ ] the end card closes the pass
// [ ] a live region says where you are: "Card 1 of 3", the end card's text
// [ ] haptics on next, previous, reshuffle, the end card's reshuffle and a chip toggle; never on a flip
// [ ] the fullscreen chip leads the panel; f toggles fullscreen
// [ ] the wake lock is asked for on the first input
// [ ] performance mark flash:first-card once the fonts are in and the first card is on screen, once per page load
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Deck } from "../../shared/types";
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

beforeEach(() => {
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
});
