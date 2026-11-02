import { hc } from "hono/client";
import type { Api } from "../../server/api";
import type { Card, Deck } from "../../shared/types";

// Typed by the server's routes through `Api`, a type-only import: no server code reaches the bundle.
export function createClient(base = location.origin, fetchImpl?: typeof fetch) {
  return hc<Api>(base, { fetch: fetchImpl });
}

// A deck this code can't read. The deck is fetched fresh at launch but the code arrives one launch late, so after a
// deploy that changes the wire the code running may be older than the deck it gets (or, offline, newer than the deck
// the worker kept). The types promise nothing across that gap: an old client read a renamed field as nothing and
// showed every back blank (2 Nov 2026).
export class OutOfDate extends Error {
  override name = "OutOfDate";
}

export async function fetchDeck(client = createClient()): Promise<Deck> {
  const res = await client.api.cards.$get();
  if (!res.ok) throw new Error(`GET /api/cards: ${res.status}`);
  const body: unknown = await res.json();
  if (!readsAsDeck(body)) throw new OutOfDate("GET /api/cards: a deck this app can't read");
  return body;
}

// Every field this code reads, of the type it reads; fields it doesn't know pass, since an addition breaks nothing.
// Written out rather than shared/schema.ts's DeckSchema, whose Zod would cost the bundle about 15 kB.
function readsAsDeck(value: unknown): value is Deck {
  return (
    isObject(value) &&
    typeof value.version === "string" &&
    isStrings(value.topics) &&
    Array.isArray(value.cards) &&
    value.cards.every(readsAsCard)
  );
}

function readsAsCard(value: unknown): value is Card {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    isStrings(value.topics) &&
    typeof value.questionHtml === "string" &&
    isStrings(value.answerPages)
  );
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
