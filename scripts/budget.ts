import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// docs/plan.md §12, in bytes. A kB is 1000 bytes, as Vite reports sizes.
const BUDGETS = [
  { key: "js", label: "JS (gzip)", limit: 100_000 },
  { key: "css", label: "CSS (gzip)", limit: 12_000 },
  { key: "fonts", label: "fonts", limit: 240_000 },
  { key: "precache", label: "precache", limit: 700_000 },
] as const;

export type Sizes = ReturnType<typeof measure>;

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

export function breaches(sizes: Sizes): string[] {
  return BUDGETS.filter((b) => sizes[b.key] > b.limit).map(
    (b) => `${b.label}: ${kB(sizes[b.key])}, over the ${b.limit / 1000} kB budget`,
  );
}

export function table(sizes: Sizes): string {
  return align(
    BUDGETS.map((b) => [
      b.label,
      kB(sizes[b.key]),
      "of",
      `${b.limit / 1000} kB`,
      `${Math.round((100 * sizes[b.key]) / b.limit)}%`,
    ]),
  );
}

const kB = (bytes: number) => `${(bytes / 1000).toFixed(2)} kB`;

// Pads every column to its widest cell: the first on the right, the others on the left, so the numbers line up.
function align(rows: string[][]): string {
  const width = (i: number) => Math.max(...rows.map((row) => row[i]?.length ?? 0));
  return rows
    .map((row) => row.map((cell, i) => (i === 0 ? cell.padEnd(width(i)) : cell.padStart(width(i)))).join(" "))
    .join("\n");
}

const matches = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => m[1] ?? "");
const sum = (paths: Iterable<string>, size: (path: string) => number) =>
  Array.from(paths, (path) => size(path)).reduce((a, b) => a + b, 0);
