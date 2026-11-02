import { hc } from "hono/client";
import type { Api } from "../../server/api";
import { type Deck, WIRE } from "../../shared/types";

// Typed by the server's routes through `Api`, a type-only import: no server code reaches the bundle.
export function createClient(base = location.origin, fetchImpl?: typeof fetch) {
  return hc<Api>(base, { fetch: fetchImpl });
}

// A deck in a wire other than this code's. The deck is fetched fresh at launch but the code arrives one launch late, so
// after a deploy that changes the wire the code running may be older than the deck it gets (or, offline, newer than the
// deck the worker kept). The types promise nothing across that gap: an old client read a renamed field as nothing and
// showed every back blank (2 Nov 2026).
export class OutOfDate extends Error {
  override name = "OutOfDate";
}

export async function fetchDeck(client = createClient()): Promise<Deck> {
  const res = await client.api.cards.$get();
  if (!res.ok) throw new Error(`GET /api/cards: ${res.status}`);
  const deck = await res.json();
  if (deck.wire !== WIRE) throw new OutOfDate(`GET /api/cards: wire ${deck.wire}, this app reads ${WIRE}`);
  return deck;
}
