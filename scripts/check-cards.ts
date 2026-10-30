// bun scripts/check-cards.ts [--version] <file>: checks a deck exactly as the server loads it.
import { loadDeck } from "../server/deck";

const [file = ""] = process.argv.slice(2);
const deck = loadDeck(await Bun.file(file).text());
console.log(`ok: ${deck.cards.length} cards, ${deck.topics.length} topics, version ${deck.version}`);
