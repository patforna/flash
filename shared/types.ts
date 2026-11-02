// The wire shape of GET /api/cards. An answer is one to three pages of HTML, split at the deck's `---` lines.
export type Card = { id: string; topics: string[]; questionHtml: string; answerPages: string[] };
export type Deck = { wire: number; version: string; topics: string[]; cards: Card[] };

// The wire's shape, by number: up by one with every change to it, which shared/schema.test.ts enforces. The server
// sends its own, the client reads only its own (src/api/client.ts).
export const WIRE = 1;
