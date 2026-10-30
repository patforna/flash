import { z } from "zod";

export const CardsFileSchema = z.object({
  topics: z.array(z.string()),
  card: z.array(z.object({ question: z.string(), topics: z.array(z.string()), answer: z.string() })),
});
