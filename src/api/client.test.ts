// To do:
// [x] fetchDeck gets the deck with GET /api/cards at the client's base
// [ ] fetchDeck throws on a status other than 2xx, naming it
// [ ] the client's base defaults to the page's origin
import { describe, expect, test } from "vitest";
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
});
