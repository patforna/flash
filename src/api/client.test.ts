// To do:
// [x] fetchDeck gets the deck with GET /api/cards at the client's base
// [x] fetchDeck throws on a status other than 2xx, naming it
// [x] the client's base defaults to the page's origin
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Deck } from "../../shared/types";
import { createClient, fetchDeck } from "./client";

const deck: Deck = {
  version: "abcdefghijkl",
  topics: ["Redis"],
  cards: [
    { id: "what-is-redis-for", topics: ["Redis"], questionHtml: "What is Redis for?", answerHtml: "<p>Caching.</p>" },
  ],
};

// A fetch that answers every request with `status` and `body`, and keeps the requests.
function server(status: number, body: unknown) {
  const requests: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(`${request.method} ${request.url}`);
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
  return { requests, fetchImpl };
}

describe("fetchDeck", () => {
  test("gets the deck with GET /api/cards at the client's base", async () => {
    const { requests, fetchImpl } = server(200, deck);

    expect(await fetchDeck(createClient("https://flash.test", fetchImpl))).toEqual(deck);
    expect(requests).toEqual(["GET https://flash.test/api/cards"]);
  });

  test("throws on a status other than 2xx, naming it", async () => {
    const { fetchImpl } = server(503, { error: "down" });

    await expect(fetchDeck(createClient("https://flash.test", fetchImpl))).rejects.toThrow("GET /api/cards: 503");
  });

  test("asks the page's own origin through the global fetch by default", async () => {
    const { requests, fetchImpl } = server(200, deck);
    vi.stubGlobal("fetch", fetchImpl);

    expect(await fetchDeck()).toEqual(deck);
    expect(requests).toEqual([`GET ${location.origin}/api/cards`]);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
