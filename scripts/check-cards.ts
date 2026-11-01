// bun scripts/check-cards.ts [--version] <file>: checks a deck exactly as the server loads it.
// The flag may follow the path, as `bun run cards:check --version` passes it.
import { DeckError, loadDeck } from "../server/deck";

function fail(...lines: string[]): never {
  for (const line of lines) console.error(line);
  process.exit(1);
}

const args = process.argv.slice(2);
const [file, ...others] = args.filter((arg) => arg !== "--version");
if (file === undefined || others.length > 0) fail("usage: bun scripts/check-cards.ts [--version] <file>");

const text = await Bun.file(file)
  .text()
  .catch((error: NodeJS.ErrnoException) =>
    error.code === "ENOENT" && file === "cards/cards.toml"
      ? fail('no deck at cards/cards.toml: copy cards/example.toml there, or link your own (README, "Your deck")')
      : fail(`can't read ${file} (${error.code})`),
  );
try {
  const deck = loadDeck(text);
  console.log(
    args.includes("--version")
      ? deck.version
      : `ok: ${deck.cards.length} cards, ${deck.topics.length} topics, version ${deck.version}`,
  );
} catch (error) {
  if (!(error instanceof DeckError)) throw error;
  fail(...error.problems);
}
