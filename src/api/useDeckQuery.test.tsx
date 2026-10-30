// To do:
// [x] loads the deck under the key ["deck"], once, in StrictMode
// [ ] retries twice, then fails with the error
// [ ] keeps the deck for the session: a second reader gets it without a request; no refetch on focus or reconnect
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Deck } from "../../shared/types";
import { useDeckQuery } from "./useDeckQuery";

const deck: Deck = {
  version: "abcdefghijkl",
  topics: ["Redis"],
  cards: [
    { id: "what-is-redis-for", topics: ["Redis"], questionHtml: "What is Redis for?", answerHtml: "<p>Caching.</p>" },
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
});
