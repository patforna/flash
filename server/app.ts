import { serveStatic } from "@hono/bun";
import { Hono } from "hono";
import type { Deck } from "../shared/types";
import { createApi } from "./api";

export function createApp({ deck, distDir }: { deck: Deck; distDir: string }): Hono {
  return new Hono().route("/", createApi(deck)).get(
    "*",
    serveStatic({
      root: distDir,
      onFound: (_, c) => {
        c.header("Cache-Control", "no-cache");
      },
    }),
  );
}
