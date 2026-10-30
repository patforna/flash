import { readFileSync } from "node:fs";
import { join } from "node:path";

export function measure(dir: string) {
  const html = readFileSync(join(dir, "index.html"), "utf8");
  const scripts = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1] ?? "");
  const js = scripts.reduce((sum, url) => sum + Bun.gzipSync(readFileSync(join(dir, url))).length, 0);
  return { js, css: 0, fonts: 0, precache: 0 };
}
