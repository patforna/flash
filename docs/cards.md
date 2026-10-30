# Writing cards

The deck is one file, `cards/cards.toml`. Edit it here, by hand or with Claude Code, check it, then ship it; the app only reads it.

## The format

[TOML](https://toml.io): the topics, then one `[[card]]` table per card, each with exactly a `question`, its `topics` and an `answer`.

````toml
# flash deck. Edit, run `bun run cards:check`, ship with `scripts/deploy-do.sh cards`. Rules: docs/cards.md.
topics = ["Redis", "Postgres", "Queues"]

# Corrected: notes line 129 say "LRU eviction by default"; redis.conf: maxmemory-policy noeviction (redis.io/docs/latest/develop/reference/eviction).
[[card]]
question = "What does Redis do by default when memory is full?"
topics = ["Redis"]
answer = '''
**Nothing is evicted.** The default policy is `noeviction`: once `maxmemory` is reached, writes fail with an OOM error; reads still work.
- On 64-bit, `maxmemory` defaults to 0 (no limit), so set one.
- For a cache, configure `allkeys-lru` (or `allkeys-lfu`).
'''

[[card]]
question = "How can workers share one Postgres job table without blocking?"
topics = ["Postgres", "Queues"]
answer = '''
Each worker locks the row it claims and skips rows that others hold:
```sql
SELECT id FROM jobs
WHERE status = 'queued'
ORDER BY id
LIMIT 1
FOR UPDATE SKIP LOCKED;
```
Do the job in that transaction, then mark it done.
'''
````

- The question goes in double quotes: write `\"` for a double quote inside it and `\\` for a backslash; apostrophes need nothing.
- The answer goes between two `'''` lines: everything in between is taken as typed, with no escapes, and the line break after the opening `'''` doesn't count. An answer can't contain `'''`.
- Lines starting with `#` are comments, for the author only: the app never shows them.

## Rules

`bun run cards:check` enforces all of them; the numbers live in `LIMITS` in `shared/schema.ts`.

- **The file** has exactly two keys at the top level: `topics` and `card`.
- **`topics`**: 1–30 labels, no repeats. A label is 1–20 characters: unaccented letters, digits, spaces and `& + . / -`, starting with a letter or a digit, with no space at the end. Every label is used by at least one card. Their order is the panel's order.
- **Cards**: 1–500 `[[card]]` tables, each with exactly `question`, `topics` and `answer`. Any other key fails, which catches a typo such as `topic =`.
- **`question`**: 1–100 characters once trimmed, with at least one letter or digit (the id is made of them), on one line, with inline markup only (`code` and `**bold**`). No two questions may be the same, ignoring case.
- **A card's `topics`**: 1–3 of the declared labels, no repeats.
- **`answer`**: 1–520 characters once trimmed and at most 11 lines, counting blank lines and code lines: the most the smallest writing holds. Code lines are at most 46 characters. No tabs.
- **Characters**: only those the two fonts have (the list is `shared/glyphs.ts`). Anything else fails, naming the character and its code point.
- **Id**: each card's id comes from its question: lowercase ASCII words joined by `-`, at most 64 characters. Two questions that make the same id fail.

## Markup

Answers use a small part of Markdown; questions only `code` and `**bold**`.

| You write                                     | On the card                                                              |
|-----------------------------------------------|--------------------------------------------------------------------------|
| a line of text                                | a line on the card: each line you write starts one, and a long one wraps |
| a blank line between two paragraphs           | one empty ruled line                                                     |
| `- item` on consecutive lines                 | a list, each item with a pink dash in the margin                         |
| `1. item` on consecutive lines                | a numbered list, with pink numbers                                       |
| `**words**`                                   | highlighted                                                              |
| `` `code` ``                                  | code, inline                                                             |
| three backticks on the lines before and after | a block of code, exactly as typed                                        |
| `->`, `<-` and `<->`                          | →, ← and ↔ (`-->` and `<--` too), except inside code                     |

```markdown
Sets a key **only if it doesn't exist**: 1 if it set it, 0 if not.
Used for simple locks:
- `SET lock:42 me NX PX 30000` also sets an expiry.
- So the lock frees itself if its holder dies.

Release it with a script that checks the value first.
```

- A list can follow its lead-in line directly. A numbered list after a lead-in line must start at `1.`, or it stays plain text.
- A line straight after a list, with no blank line in between, joins the list's last item.
- Code blocks are never wrapped or scrolled, which is why their lines are at most 46 characters. A language after the opening fence (` ```sql `) is allowed and changes nothing: there is no highlighting.
- Where a long line wraps is up to the app: never inside a hyphenated word (`staff-level`, `allkeys-lfu`) or a range (2–4), never between a number and the word it counts (7 days, 1.5M requests), and inline code holds together where a break would split it (a span of up to 20 characters, a word of one or two at either end of a longer one, a quoted value of up to 18).
- Long answers are written smaller, in two steps. One that still doesn't fit fails the fit test, which runs when you ship.

These fail, naming the card and the reason:

| Markup                                          | Why                                                                              |
|-------------------------------------------------|----------------------------------------------------------------------------------|
| a loose list: a blank line between items        | each item becomes a paragraph; keep items on consecutive lines                   |
| a heading: `# Title`                            | the question is the card's only heading                                          |
| `---` straight under a line of text             | Markdown reads it as underlining a heading                                       |
| `---` on a line of its own                      | a rule, which a card doesn't have                                                |
| a link: `[text](url)`                           | nothing on a card can be opened; a bare URL stays plain text                     |
| a line starting `[label]:`, however indented    | Markdown reads it as a link's reference and hides it, even in a list item        |
| emphasis: `*words*` or `_words_`                | no italics in the handwriting; `a*b*c` counts too, so put such text in backticks |
| a list inside a list                            | one level of list only                                                           |
| an image `![alt](src)` or a quote `> text`      | cards are text only                                                              |
| an unclosed fence                               | the rest of the answer would turn into code                                      |
| a character the fonts lack                      | it would show in some other font                                                 |

A fence closes only on a line holding nothing but the character it opened with (` ``` ` or `~~~`), at least as many of them; how far either is indented doesn't matter.

Characters the fonts lack include ✓ and ✗, ⇒, Greek letters such as λ and π, emoji, and invisible ones pasted from elsewhere: the thin space (U+2009) and the narrow no-break space (U+202F). Covered, among others: → ← ↔ ↑ ↓ ≤ ≥ ≈ ≠ × ± ∞ – — “ ” ‘ ’ … € £ µ ° ² ½ •.

These don't fail but show exactly as typed: HTML tags such as `<b>`, tables, `~~strikethrough~~` and `- [ ] task` boxes. Indenting by four spaces doesn't make code: use a fence.

## Writing a good card

- **One idea per card**: what you could answer aloud in 20–40 seconds. Two facts share a card only when one explains the other.
- **The question** is a question, a prompt ("Tell me about…") or just a topic. Write what you would be asked: What, Why, How, When, "Walk through", "Sketch", in about 40–80 characters.
- **The answer** gives the gist first, in one line, then up to 4 bullets. Aim for 150–350 characters. Highlight one or two key facts at most.
- Tight lists only, with no blank lines between items. Numbers with units. British spelling.
- **Self-contained**: it makes sense without the notes or any other card.
- **Corrections** of the source notes go in a `# Corrected:` comment above the card, citing the notes' line and a primary source; anything added beyond the notes in an `# Added:` comment with its source. Never on the card: it's study material, not commentary.
- **Nothing private**: the address is public (every certificate is logged publicly), even though search engines are told not to index it.

## Topics

The 13 topics, in panel order: Patterns, Case studies, Sharding, Real-time, Edge, Postgres, SQL, Queues, Streams, Redis, Consistency, Concurrency.

- **Colour** follows the position in `topics`, cycling through pink, marigold, mint, sky, lilac, tangerine, teal and lime, so neighbours never share one. Inserting a topic shifts the colours of those after it.
- **To add one**, put its label in `topics` where it should appear in the panel, and use it on at least one card.
- **To rename one**, change it in `topics` and on every card: search and replace the quoted label, such as `"Real-time"`. The phone forgets a selection whose label disappeared.
- **To remove one**, take it out of `topics` and off every card; a card left with no topic fails.

## Checking and shipping

1. Edit `cards/cards.toml`.
2. `bun run cards:check`: every problem at once, in under a second.
3. Commit and push.
4. `scripts/deploy-do.sh cards`: about 30 s.
5. On the phone, close the app and open it again: it fetches the deck fresh at launch, and keeps the last one for reading offline.

`cards:check` lists every problem, one per line, naming the card, and exits 1; a TOML syntax error comes with its line and column:

```text
card 12 "what-does-redis-do-by-default-when-memory-is-full": answer is 611 characters (max 520)
```

The server refuses to start with the same list, so a broken deck never goes live.

`scripts/deploy-do.sh cards` ships the deck alone, never code: it runs the check, stops unless the droplet runs the code this checkout builds (if not, ship the code first with `scripts/deploy-do.sh up`), runs the fit test (every card of the real deck fits without scrolling, and every topic chip in the panel), uploads the file, restarts the server and confirms that https://flash.patforna.com/healthz reports the new deck's version, which `bun scripts/check-cards.ts --version cards/cards.toml` prints. Should the server refuse the deck all the same, the last one goes back.

## The seed deck

How the first deck was made from the system design notes, the stubs left out and every correction: [seed.md](seed.md).
