import { parse } from "smol-toml";
import { CardsFileSchema, LIMITS } from "../shared/schema";
import type { Deck } from "../shared/types";
import { renderAnswer, renderQuestion } from "./markdown";

export function slug(text: string): string {
  return text
    .normalize("NFKD") // "é" → "e" and a combining accent, which goes
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, LIMITS.id)
    .replace(/-$/, "");
}

export function loadDeck(toml: string): Deck {
  const file = CardsFileSchema.parse(parse(toml));
  const cards = file.card.map((card) => {
    const question = renderQuestion(card.question.trim());
    const answer = renderAnswer(card.answer.trim());
    return {
      id: slug(card.question),
      topics: card.topics,
      questionHtml: "html" in question ? question.html : "",
      answerHtml: "html" in answer ? answer.html : "",
    };
  });
  return { version: "", topics: file.topics, cards };
}
