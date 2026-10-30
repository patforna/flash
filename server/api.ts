import { Hono } from "hono";
import { etag } from "hono/etag";
import type { Deck } from "../shared/types";

// The browser program type-checks this file through the client's `import type { Api }`: nothing Bun-specific here.
// The return type is inferred from the chained routes, never annotated, so the routes' types reach the client.
export function createApi(deck: Deck) {
  return new Hono()
    .use("/api/cards", etag()) // a 304 when If-None-Match holds the ETag set below
    .get("/api/cards", (c) => {
      c.header("ETag", `"${deck.version}"`);
      c.header("Cache-Control", "no-cache");
      return c.json(deck);
    })
    .get("/healthz", (c) => {
      c.header("Cache-Control", "no-store");
      return c.json({ ok: true, cards: deck.cards.length, version: deck.version });
    });
}

export type Api = ReturnType<typeof createApi>;
