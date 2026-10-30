// To do:
// [x] GET /healthz answers 200 with ok, the card count and the version, never cached
// [ ] GET /api/cards returns the deck with its ETag and no-cache
// [ ] a matching If-None-Match gets 304 and no body, weak and listed tags included
// [ ] HEAD answers like GET
// [ ] contract: the /api/cards body parses with the wire schema
import { describe, expect, test } from "bun:test";
import { createApi } from "./api";
import { loadDeck } from "./deck";

const deck = loadDeck(await Bun.file(`${import.meta.dir}/../tests/fixtures/cards.toml`).text());
const api = createApi(deck);

describe("GET /healthz", () => {
  test("answers ok with the card count and the version, never cached", async () => {
    const res = await api.request("/healthz");

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, cards: 9, version: deck.version });
  });
});
