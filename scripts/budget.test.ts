import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { measure } from "./budget";

// To do:
// [x] an empty build measures zero
// [ ] JS: the gzipped size of the scripts index.html references, and nothing else
// [ ] CSS: the gzipped size of the stylesheets index.html references
// [ ] fonts: the raw size of every woff2 file
// [ ] precache: the raw size of every file sw.js precaches, each counted once
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

test("an empty build measures zero", () => {
  expect(measure(dist({ "index.html": html(""), "sw.js": sw([]) }))).toEqual({ js: 0, css: 0, fonts: 0, precache: 0 });
});
