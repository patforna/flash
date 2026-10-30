// To do:
// [x] slug: lowercase ASCII words joined by "-"; accents dropped; at most 64 characters, never ending in "-"
// [x] loadDeck turns a minimal deck into its declared topics and cards, ids slugged from the questions
// [x] the version: 12 base64url characters, stable for the same deck, different when a card changes
// [x] loadDeck reports every problem at once, naming the card: undeclared topic, duplicate question, long question, unknown key
// [x] a TOML syntax error is one problem with its line and column
// [ ] shape: unknown top-level key, missing field, wrong type; a misspelt key doesn't stop the other cards' checks
// [ ] declared topics: 1–30, 1–20 characters, the pattern, no trailing space, no repeats, each used
// [ ] cards: 1–500
// [ ] a card's topics: 1–3, declared, no repeats
// [ ] question: 8–100 characters after trimming, one line, inline markup only, unique ignoring case
// [ ] answer: 1–520 characters after trimming, at most 12 lines, code lines at most 46 characters, no tabs, markup
// [ ] characters the fonts don't cover fail, named with their code point
// [ ] ids unique: different questions with the same slug
// [ ] the fixture deck loads cleanly
import { describe, expect, test } from "bun:test";
import { stringify } from "smol-toml";
import { DeckError, loadDeck, slug } from "./deck";

type RawCard = Record<string, unknown>;
const card = (fields: RawCard = {}): RawCard => ({
  question: "What is Redis for?",
  topics: ["Redis"],
  answer: "Caching.",
  ...fields,
});
const file = (cards: RawCard[], topics: string[] = ["Redis"]) => stringify({ topics, card: cards });

function problemsOf(toml: string): string[] {
  try {
    loadDeck(toml);
  } catch (error) {
    if (error instanceof DeckError) return error.problems;
    throw error;
  }
  return [];
}

describe("slug", () => {
  test("joins the lowercase words of a question with dashes", () => {
    expect(slug("What does Redis do by default when memory is full?")).toBe(
      "what-does-redis-do-by-default-when-memory-is-full",
    );
  });

  test("keeps only ASCII letters and digits, dropping accents", () => {
    expect(slug("Why `SETNX` in a café, not Ünicode → ?")).toBe("why-setnx-in-a-cafe-not-unicode");
  });

  test("cuts at 64 characters and never ends in a dash", () => {
    const id = slug("How can several workers take jobs from one Postgres table without blocking each other?");

    expect(id).toBe("how-can-several-workers-take-jobs-from-one-postgres-table-withou");
    expect(slug(`${"a".repeat(63)} b`)).toBe("a".repeat(63));
  });
});

describe("loadDeck", () => {
  test("turns a minimal deck into its declared topics and cards, ids slugged from the questions", () => {
    const deck = loadDeck(`
topics = ["Redis", "Postgres"]

[[card]]
question = "What does \`SETNX\` do?"
topics = ["Redis"]
answer = '''
Sets a key **only if it is absent**.
'''

[[card]]
question = "  Why does Postgres need VACUUM?  "
topics = ["Postgres", "Redis"]
answer = "Dead tuples."
`);

    expect(deck.topics).toEqual(["Redis", "Postgres"]);
    expect(deck.cards).toEqual([
      {
        id: "what-does-setnx-do",
        topics: ["Redis"],
        questionHtml: "What does <code>SETNX</code> do?",
        answerHtml: "<p>Sets a key <strong>only if it is absent</strong>.</p>",
      },
      {
        id: "why-does-postgres-need-vacuum",
        topics: ["Postgres", "Redis"],
        questionHtml: "Why does Postgres need VACUUM?",
        answerHtml: "<p>Dead tuples.</p>",
      },
    ]);
  });

  test("versions the deck: the first 12 characters of the base64url SHA-256 of its JSON", () => {
    const toml = 'topics = ["Redis"]\n[[card]]\nquestion = "What is Redis?"\ntopics = ["Redis"]\nanswer = "A store."';
    const { version, topics, cards } = loadDeck(toml);
    const sha = new Bun.CryptoHasher("sha256").update(JSON.stringify({ topics, cards })).digest("base64url");

    expect(version).toBe(sha.slice(0, 12));
    expect(loadDeck(toml.replace("A store.", "A cache.")).version).not.toBe(version);
  });

  test("reports every problem at once, naming the card", () => {
    const long =
      "Why would anyone write a question this long, one that runs right past the limit of one hundred chars?";
    const toml = file([
      card({ question: "What does Redis do?", topics: ["Redis", "Kafka"] }),
      card({ question: "what does REDIS do?" }),
      card({ question: long }),
      card({ question: "Which key is misspelt?", topic: "Redis" }),
    ]);

    expect(problemsOf(toml)).toEqual([
      'card 1 "what-does-redis-do": topic "Kafka" is not declared',
      'card 2 "what-does-redis-do": question duplicates card 1',
      'card 3 "why-would-anyone-write-a-question-this-long-one-that-runs-right": question is 101 characters (max 100)',
      'card 4 "which-key-is-misspelt": unknown key "topic"',
    ]);
  });

  test("reports a TOML syntax error with its line and column", () => {
    expect(problemsOf('topics = ["Redis"]\n\n[[card]]\nquestion = What is Redis?\n')).toEqual([
      "line 4, column 12: invalid value",
    ]);
  });
});
