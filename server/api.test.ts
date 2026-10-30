// To do:
// [x] GET /healthz answers 200 with ok, the card count and the version, never cached
// [x] GET /api/cards returns the deck with its ETag and no-cache
// [x] a matching If-None-Match gets 304 and no body, weak and listed tags included
// [x] HEAD answers like GET
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

describe("GET /api/cards", () => {
  test("returns the deck with its version as the ETag, to be revalidated on every use", async () => {
    const res = await api.request("/api/cards");

    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe(`"${deck.version}"`);
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(await res.json()).toEqual(deck);
  });

  test.each([`"${deck.version}"`, `W/"${deck.version}"`, `"stale", "${deck.version}"`, "*"])(
    "answers 304 with no body for If-None-Match: %s",
    async (tag) => {
      const res = await api.request("/api/cards", { headers: { "If-None-Match": tag } });

      expect(res.status).toBe(304);
      expect(await res.text()).toBe("");
      expect(res.headers.get("ETag")).toBe(`"${deck.version}"`);
      expect(res.headers.get("Cache-Control")).toBe("no-cache");
    },
  );

  test("answers 200 with the deck for a stale If-None-Match", async () => {
    const res = await api.request("/api/cards", { headers: { "If-None-Match": '"stale"' } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(deck);
  });
});

describe("HEAD", () => {
  test.each(["/api/cards", "/healthz"])("answers %s like GET, without the body", async (path) => {
    const get = await api.request(path);
    const head = await api.request(path, { method: "HEAD" });

    expect(head.status).toBe(200);
    expect(head.headers.get("ETag")).toBe(get.headers.get("ETag"));
    expect(head.headers.get("Cache-Control")).toBe(get.headers.get("Cache-Control"));
    expect(head.headers.get("Content-Type")).toBe(get.headers.get("Content-Type"));
    expect(await head.text()).toBe("");
  });
});
