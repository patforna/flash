// To do:
// [x] loads the deck under the key ["deck"], once, in StrictMode
// [x] retries twice, then fails with the error
// [x] keeps the deck for the session: a later reader gets it without a request, and it outlives its readers
// [x] after failing, waits to be asked again: no refetch on focus or reconnect
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Deck } from "../../shared/types";
import { useDeckQuery } from "./useDeckQuery";

const deck: Deck = {
  version: "abcdefghijkl",
  topics: ["Redis"],
  cards: [
    {
      id: "what-is-redis-for",
      topics: ["Redis"],
      questionHtml: "What is Redis for?",
      answerPages: ["<p>Caching.</p>"],
    },
  ],
};

// The global fetch the default client uses, answering every request with `status` and `body`.
function answer(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderDeckQuery() {
  // No backoff between retries in tests.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StrictMode>
  );
  return { queryClient, wrapper, ...renderHook(() => useDeckQuery(), { wrapper }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});

describe("useDeckQuery", () => {
  test('loads the deck under the key ["deck"], once', async () => {
    const fetchMock = answer(200, deck);

    const { result, queryClient } = renderDeckQuery();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(deck);
    expect(queryClient.getQueryData(["deck"])).toEqual(deck);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("retries twice, then fails with the error", async () => {
    const fetchMock = answer(503, { error: "down" });

    const { result } = renderDeckQuery();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("GET /api/cards: 503");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("keeps the deck for the session: a later reader gets it without a request, and it outlives its readers", async () => {
    const fetchMock = answer(200, deck);
    const { result, queryClient, wrapper, unmount } = renderDeckQuery();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const later = renderHook(() => useDeckQuery(), { wrapper });
    vi.useFakeTimers();
    unmount();
    later.unmount();
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);

    expect(later.result.current.data).toEqual(deck);
    expect(queryClient.getQueryData(["deck"])).toEqual(deck);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("after failing, waits to be asked again: no refetch on focus or reconnect", async () => {
    const fetchMock = answer(503, { error: "down" });
    const { result } = renderDeckQuery();
    await waitFor(() => expect(result.current.isError).toBe(true));

    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
