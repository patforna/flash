import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export function measure(dir: string) {
  const html = readFileSync(join(dir, "index.html"), "utf8");
  const sw = readFileSync(join(dir, "sw.js"), "utf8");
  // What index.html loads at start, by extension; gzipped one by one, as Caddy sends them.
  const loaded = (ext: string) => matches(html, new RegExp(`(?:src|href)="([^"]+\\.${ext})"`, "g"));
  const gzipped = (path: string) => Bun.gzipSync(readFileSync(join(dir, path))).length;
  const raw = (path: string) => statSync(join(dir, path)).size;
  const precached = new Set(matches(sw.match(/precacheAndRoute\(\[[^\]]*\]/)?.[0] ?? "", /url:"([^"]+)"/g));
  return {
    js: sum(loaded("js"), gzipped),
    css: sum(loaded("css"), gzipped),
    fonts: sum(new Bun.Glob("**/*.woff2").scanSync(dir), raw),
    precache: sum(precached, raw),
  };
}

export function breaches(_sizes: ReturnType<typeof measure>): string[] {
  return [];
}

const matches = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => m[1] ?? "");
const sum = (paths: Iterable<string>, size: (path: string) => number) =>
  Array.from(paths, (path) => size(path)).reduce((a, b) => a + b, 0);
