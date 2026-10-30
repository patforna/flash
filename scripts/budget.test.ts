import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { measure } from "./budget";

// To do:
// [x] an empty build measures zero
// [x] JS: the gzipped size of the scripts index.html references, and nothing else
// [x] CSS: the gzipped size of the stylesheets index.html references
// [x] fonts: the raw size of every woff2 file
// [x] precache: the raw size of every file sw.js precaches, each counted once
// [ ] breaches: none at the limits; one line per budget exceeded, with the size and the limit
// [ ] table: one aligned row per budget, with the size, the limit and the share used
// [ ] the command: within budget it prints the table and exits 0
// [ ] the command: over budget it prints the breaches and exits 1
// [ ] the command: reads dist by default

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

// A dist/ directory in a temp dir holding the given files.
function dist(files: Record<string, string | Uint8Array>): string {
  const dir = mkdtempSync(join(tmpdir(), "flash-budget-"));
  dirs.push(dir);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

const html = (head: string) => `<!doctype html><html><head>${head}</head><body></body></html>`;

// The shape of the service worker vite-plugin-pwa generates, minified.
const sw = (urls: string[]) =>
  `define(["./workbox-1"],function(e){"use strict";e.precacheAndRoute([${urls.map((url) => `{url:"${url}",revision:null}`).join(",")}],{})});`;

const gzipped = (text: string) => Bun.gzipSync(text).length;

test("an empty build measures zero", () => {
  expect(measure(dist({ "index.html": html(""), "sw.js": sw([]) }))).toEqual({ js: 0, css: 0, fonts: 0, precache: 0 });
});

test("JS is the gzipped size of the scripts index.html references, and nothing else", () => {
  const app = "export const app = 1;\n".repeat(40);
  const vendor = "export const vendor = 2;\n".repeat(30);
  const register = "navigator.serviceWorker.register('/sw.js');";
  const dir = dist({
    "index.html": html(
      '<script type="module" crossorigin src="/assets/app.js"></script>' +
        '<link rel="modulepreload" crossorigin href="/assets/vendor.js">' +
        '<script id="vite-plugin-pwa:register-sw" src="/registerSW.js" defer></script>',
    ),
    "assets/app.js": app,
    "assets/vendor.js": vendor,
    "assets/lazy.js": "export const lazy = 3;",
    "registerSW.js": register,
    "sw.js": sw([]),
  });
  expect(measure(dir).js).toBe(gzipped(app) + gzipped(vendor) + gzipped(register));
});

test("CSS is the gzipped size of the stylesheets index.html references", () => {
  const app = ".card { color: #1f2d6b; }\n".repeat(40);
  const dir = dist({
    "index.html": html('<link rel="stylesheet" crossorigin href="/assets/app.css">'),
    "assets/app.css": app,
    "assets/lazy.css": ".lazy { color: red; }",
    "sw.js": sw([]),
  });
  expect(measure(dir).css).toBe(gzipped(app));
});

test("fonts are the raw size of every woff2 file", () => {
  const dir = dist({
    "index.html": html(""),
    "sw.js": sw([]),
    "assets/hand.woff2": new Uint8Array(1_000),
    "assets/code.woff2": new Uint8Array(234),
    "assets/icon.png": new Uint8Array(5_000),
  });
  expect(measure(dir).fonts).toBe(1_234);
});

// vite-plugin-pwa lists manifest.webmanifest twice: it adds it itself, and the glob matches it too.
test("precache is the raw size of every file sw.js precaches, each counted once", () => {
  const dir = dist({
    "index.html": html(""),
    "sw.js": sw(["index.html", "manifest.webmanifest", "assets/app.js", "manifest.webmanifest"]),
    "manifest.webmanifest": new Uint8Array(400),
    "assets/app.js": new Uint8Array(200_000),
    "workbox-1.js": new Uint8Array(22_000),
  });
  expect(measure(dir).precache).toBe(html("").length + 400 + 200_000);
});
