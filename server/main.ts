// The server: refuses to start on a bad deck, else serves it and the built app.
import type { Deck } from "../shared/types";
import { createApp } from "./app";
import { DeckError, loadDeck } from "./deck";

const { PORT = "3000", HOST = "0.0.0.0", CARDS = "cards/cards.toml", DIST = "dist" } = process.env;

let deck: Deck;
try {
  deck = loadDeck(await Bun.file(CARDS).text());
} catch (error) {
  if (!(error instanceof DeckError)) throw error;
  for (const problem of error.problems) console.error(problem);
  process.exit(1);
}

const server = Bun.serve({ hostname: HOST, port: Number(PORT), fetch: createApp({ deck, distDir: DIST }).fetch });
console.log(`flash: ${deck.cards.length} cards, version ${deck.version}, on ${server.url}`);
