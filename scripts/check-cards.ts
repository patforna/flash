// bun scripts/check-cards.ts [--version] <file>: checks a deck exactly as the server loads it.
// The flag may follow the path, as `bun run cards:check --version` passes it.
import { DeckError, loadDeck } from "../server/deck";

const args = process.argv.slice(2);
const [file = ""] = args.filter((arg) => arg !== "--version");
try {
  const deck = loadDeck(await Bun.file(file).text());
  console.log(
    args.includes("--version")
      ? deck.version
      : `ok: ${deck.cards.length} cards, ${deck.topics.length} topics, version ${deck.version}`,
  );
} catch (error) {
  if (!(error instanceof DeckError)) throw error;
  for (const problem of error.problems) console.error(problem);
  process.exit(1);
}
