import { Hono } from "hono";
import type { Deck } from "../shared/types";

// The browser program type-checks this file through the client's `import type { Api }`: nothing Bun-specific here.
// The return type is inferred from the chained routes, never annotated, so the routes' types reach the client.
export function createApi(deck: Deck) {
  return new Hono().get("/healthz", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ ok: true, cards: deck.cards.length, version: deck.version });
  });
}

export type Api = ReturnType<typeof createApi>;
