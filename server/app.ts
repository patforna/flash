import { serveStatic } from "@hono/bun";
import { Hono } from "hono";
import type { Deck } from "../shared/types";
import { createApi } from "./api";

// Vite hashes what it puts in /assets/, so those never change; everything else (index.html, the service worker and
// its helpers, the manifest, the icons) keeps its name and is revalidated on every use.
const IMMUTABLE = "public, max-age=31536000, immutable";

export function createApp({ deck, distDir }: { deck: Deck; distDir: string }): Hono {
  return new Hono()
    .use(async (c, next) => {
      await next();
      // On the finished response itself: c.header() would rebuild it around a stream, and a file would lose its length.
      c.res.headers.set("X-Robots-Tag", "noindex, nofollow");
      c.res.headers.set("X-Content-Type-Options", "nosniff");
      c.res.headers.set("Referrer-Policy", "no-referrer");
    })
    .route("/", createApi(deck))
    .get(
      "*",
      serveStatic({
        root: distDir,
        onFound: (_, c) => {
          c.header("Cache-Control", c.req.path.startsWith("/assets/") ? IMMUTABLE : "no-cache");
        },
      }),
    );
}
