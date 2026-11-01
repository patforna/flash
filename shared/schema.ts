import { z } from "zod";
import type { Deck } from "./types";

export const LIMITS = {
  topics: 30,
  topicLabel: 20,
  cards: 500,
  id: 64,
  cardTopics: 3,
  questionMin: 1, // a topic alone makes a front
  questionMax: 100,
  answerMax: 520, // per page
  answerLines: 11, // per page: what the smallest fit step holds
  answerPages: 3,
  codeLine: 46,
} as const;

// The shape of cards/cards.toml, strict so that a misspelt key (`topic =`) fails. The limits and rules: server/deck.ts.
export const CardsFileSchema = z.strictObject({
  topics: z.array(z.string()),
  card: z.array(z.strictObject({ question: z.string(), topics: z.array(z.string()), answer: z.string() })),
});
export type CardsFile = z.infer<typeof CardsFileSchema>;

// The wire shape of shared/types.ts, for the contract test.
export const DeckSchema: z.ZodType<Deck> = z.strictObject({
  version: z.string(),
  topics: z.array(z.string()),
  cards: z.array(
    z.strictObject({
      id: z.string(),
      topics: z.array(z.string()),
      questionHtml: z.string(),
      answerPages: z.array(z.string()),
    }),
  ),
});
