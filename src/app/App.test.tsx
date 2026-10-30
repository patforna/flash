// To do:
// [ ] nothing for 200 ms while the deck loads, then a card reading "shuffling…"
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
import { act, render, screen } from "@testing-library/react";
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
