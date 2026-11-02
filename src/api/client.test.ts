// To do:
// [x] fetchDeck gets the deck with GET /api/cards at the client's base
// [x] fetchDeck throws on a status other than 2xx, naming it
// [x] the client's base defaults to the page's origin
// [x] fetchDeck throws OutOfDate on a deck this code can't read: the shape before 1 Nov (answerHtml), a field missing or
//     of another type; a field it doesn't know is no reason
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Deck } from "../../shared/types";
import { createClient, fetchDeck, OutOfDate } from "./client";

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

describe("fetchDeck, given a deck this code can't read", () => {
  const [card] = deck.cards;
  const unreadable: [string, unknown][] = [
    ["the shape before 1 Nov 2026", { ...deck, cards: [{ ...card, answerPages: undefined, answerHtml: "<p>x</p>" }] }],
    ["no answer at all", { ...deck, cards: [{ ...card, answerPages: undefined }] }],
    ["a page that isn't a string", { ...deck, cards: [{ ...card, answerPages: [42] }] }],
    ["no question", { ...deck, cards: [{ ...card, questionHtml: undefined }] }],
    ["topics that aren't a list", { ...deck, topics: "Redis" }],
    ["cards that aren't a list", { ...deck, cards: {} }],
    ["no version", { ...deck, version: undefined }],
    ["not an object", ["a deck?"]],
  ];

  test.each(unreadable)("throws OutOfDate on %s", async (_, body) => {
    const { fetchImpl } = server(200, body);

    await expect(fetchDeck(createClient("https://flash.test", fetchImpl))).rejects.toBeInstanceOf(OutOfDate);
  });

  test("reads a deck with a field it doesn't know: an addition breaks nothing", async () => {
    const newer = { ...deck, generated: "2026-11-02", cards: [{ ...card, hint: "x" }] };
    const { fetchImpl } = server(200, newer);

    expect(await fetchDeck(createClient("https://flash.test", fetchImpl))).toEqual(newer);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
