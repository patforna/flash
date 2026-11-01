// The wire shape of GET /api/cards. An answer is one to three pages of HTML, split at the deck's `---` lines.
export type Card = { id: string; topics: string[]; questionHtml: string; answerPages: string[] };
export type Deck = { version: string; topics: string[]; cards: Card[] };
