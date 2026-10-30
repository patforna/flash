import { hc } from "hono/client";
import type { Api } from "../../server/api";
import type { Deck } from "../../shared/types";

// Typed by the server's routes through `Api`, a type-only import: no server code reaches the bundle.
export function createClient(base = location.origin, fetchImpl?: typeof fetch) {
  return hc<Api>(base, { fetch: fetchImpl });
}

export async function fetchDeck(client = createClient()): Promise<Deck> {
  const res = await client.api.cards.$get();
  return res.json();
}
