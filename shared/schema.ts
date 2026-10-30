import { z } from "zod";
import type { Deck } from "./types";

export const LIMITS = {
  topics: 30,
  topicLabel: 20,
  cards: 500,
  id: 64,
  cardTopics: 3,
  questionMin: 8,
  questionMax: 100,
  answerMax: 520,
  answerLines: 12,
  codeLine: 46,
} as const;

// The shape of cards/cards.toml. Strict, so a misspelt key (`topic =`) fails; the limits and rules are server/deck.ts's.
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
    z.strictObject({ id: z.string(), topics: z.array(z.string()), questionHtml: z.string(), answerHtml: z.string() }),
  ),
});
