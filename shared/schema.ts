import { z } from "zod";

export const CardsFileSchema = z.strictObject({
  topics: z.array(z.string()),
  card: z.array(z.strictObject({ question: z.string(), topics: z.array(z.string()), answer: z.string() })),
});
