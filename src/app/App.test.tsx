// To do:
// [x] nothing for 200 ms while the deck loads, then a card reading "shuffling…"
// [ ] the error card once the deck can't be fetched; tapping it fetches again
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
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { App } from "./App";

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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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
