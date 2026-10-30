import { readFileSync } from "node:fs";
import { join } from "node:path";

export function measure(dir: string) {
  const html = readFileSync(join(dir, "index.html"), "utf8");
  // The files index.html loads at start with this extension, gzipped one by one as Caddy sends them.
  const gzipped = (ext: string) =>
    [...html.matchAll(new RegExp(`(?:src|href)="([^"]+\\.${ext})"`, "g"))]
      .map((m) => m[1] ?? "")
      .reduce((sum, url) => sum + Bun.gzipSync(readFileSync(join(dir, url))).length, 0);
  return { js: gzipped("js"), css: gzipped("css"), fonts: 0, precache: 0 };
}
