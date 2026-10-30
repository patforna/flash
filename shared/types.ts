// The wire shape of GET /api/cards. Frozen in M0.
export type Card = { id: string; topics: string[]; questionHtml: string; answerHtml: string };
export type Deck = { version: string; topics: string[]; cards: Card[] };
