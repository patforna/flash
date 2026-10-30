// To do:
// [ ] serves the API
// [x] serves index.html at / and /index.html, revalidated on every use
// [x] serves hashed assets as immutable for a year
// [x] serves the service worker, its helpers, the manifest and the icons, revalidated on every use
// [ ] answers 404 for anything else: missing files, other methods, traversal attempts raw and percent-encoded
// [ ] sets the robots, sniffing and referrer headers on every response: static, API, 304 and 404
// [ ] HEAD answers like GET for static files
import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createApp } from "./app";
import { loadDeck } from "./deck";

// A built dist/ as Vite and vite-plugin-pwa leave it, with a secret beside it that traversal must not reach.
const files = {
  "index.html": "<!doctype html><title>flash</title>",
  "assets/index-B2x9.js": "console.log('flash')",
  "assets/index-Cq1z.css": "body{}",
  "assets/shantell-sans-latin-full-normal-D4f1.woff2": "font",
  "sw.js": "self.skipWaiting()",
  "registerSW.js": "navigator.serviceWorker.register('/sw.js')",
  "workbox-5a8f.js": "workbox",
  "manifest.webmanifest": '{"name":"flash"}',
  "icon.svg": "<svg/>",
  "icon-192.png": "png",
};
const root = await mkdtemp(join(tmpdir(), "flash-app-"));
afterAll(() => rm(root, { recursive: true }));
for (const [path, body] of Object.entries(files)) {
  await mkdir(dirname(join(root, "dist", path)), { recursive: true });
  await writeFile(join(root, "dist", path), body);
}
await writeFile(join(root, "secret.txt"), "secret");

const deck = loadDeck(await Bun.file(`${import.meta.dir}/../tests/fixtures/cards.toml`).text());
const app = createApp({ deck, distDir: join(root, "dist") });

describe("createApp", () => {
  test("serves the API", async () => {
    const res = await app.request("/healthz");

    expect(await res.json()).toEqual({ ok: true, cards: 9, version: deck.version });
  });

  test.each(["/", "/index.html"])("serves index.html at %s, revalidated on every use", async (path) => {
    const res = await app.request(path);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toStartWith("text/html");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(await res.text()).toBe(files["index.html"]);
  });

  test.each([
    ["/assets/index-B2x9.js", "text/javascript"],
    ["/assets/index-Cq1z.css", "text/css"],
    ["/assets/shantell-sans-latin-full-normal-D4f1.woff2", "font/woff2"],
  ])("serves the hashed asset %s as immutable for a year", async (path, type) => {
    const res = await app.request(path);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toStartWith(type);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });

  test.each([
    ["/sw.js", "text/javascript"],
    ["/registerSW.js", "text/javascript"],
    ["/workbox-5a8f.js", "text/javascript"],
    ["/manifest.webmanifest", "application/manifest+json"],
    ["/icon.svg", "image/svg+xml"],
    ["/icon-192.png", "image/png"],
  ])("serves %s, revalidated on every use", async (path, type) => {
    const res = await app.request(path);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toStartWith(type);
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });
});
