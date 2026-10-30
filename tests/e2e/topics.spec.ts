import type { Page } from "@playwright/test";
import {
  announcer,
  centre,
  expect,
  firstCard,
  flick,
  flipper,
  question,
  settled,
  tap,
  test,
  topicsOf,
} from "./helpers";

// Choosing topics (docs/plan.md §3 and §5): chips toggle, a card is in the pass if it carries any selected topic, All
// clears, the card on screen survives a change that keeps it, and the selection outlives a reload. The fixture deck:
// 9 cards; Redis 2, Postgres 3, Queues 3 (one of them also Postgres), Consistency 1, Sharding 2, Real-time 2,
// Case studies 2.

test.beforeEach(async ({ page }) => {
  test.skip(test.info().project.name !== "pixel11", "taps, on the Pixel 11");
  await page.goto("/");
  await firstCard(page);
  await settled(page);
});

const chip = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

// Walks the pass to its end card, returning the topics of every card on the way.
async function walk(page: Page, total: number): Promise<string[][]> {
  const seen: string[][] = [];
  for (let position = 1; position <= total; position++) {
    await expect(announcer(page)).toHaveText(`Card ${position} of ${total}`);
    await settled(page);
    seen.push(await topicsOf(page));
    await flick(page, "left");
  }
  await expect(announcer(page)).toHaveText(`That's all ${total}. Tap or swipe to shuffle again.`);
  return seen;
}

test("a topic narrows the pass to its cards", async ({ page }) => {
  await chip(page, "Postgres, 3 cards").tap();

  await expect(chip(page, "Postgres, 3 cards")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "All, 9 cards")).toHaveAttribute("aria-pressed", "false");
  await expect(announcer(page)).toHaveText("Card 1 of 3");
  // The card's own counter, too.
  await expect(
    flipper(page)
      .locator("> :first-child")
      .getByText(/^1 \/ 3$/),
  ).toBeVisible();
  for (const topics of await walk(page, 3)) expect(topics).toContain("Postgres");
});

test("two topics: the pass holds every card carrying either (OR)", async ({ page }) => {
  // Postgres 3 and Queues 3 share one card: AND would make 1, OR makes 5.
  await chip(page, "Postgres, 3 cards").tap();
  await chip(page, "Queues, 3 cards").tap();

  await expect(announcer(page)).toHaveText("Card 1 of 5");
  const seen = await walk(page, 5);
  for (const topics of seen) expect(topics.some((t) => t === "Postgres" || t === "Queues")).toBe(true);
  expect(seen.filter((topics) => topics.includes("Postgres") && topics.includes("Queues"))).toHaveLength(1);
});

test("All clears the selection; with nothing selected it changes nothing", async ({ page }) => {
  await flick(page, "left");
  await expect(announcer(page)).toHaveText("Card 2 of 9");
  await settled(page);
  const second = await question(page).textContent();
  await chip(page, "All, 9 cards").tap();
  await expect(announcer(page)).toHaveText("Card 2 of 9");
  await expect(question(page)).toHaveText(second ?? "");

  await chip(page, "Redis, 2 cards").tap();
  await expect(announcer(page)).toHaveText("Card 1 of 2");
  await chip(page, "All, 9 cards").tap();

  await expect(chip(page, "All, 9 cards")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "Redis, 2 cards")).toHaveAttribute("aria-pressed", "false");
  await expect(announcer(page)).toHaveText("Card 1 of 9");
});

test("the card on screen survives a change that keeps it, on the side it was turned to", async ({ page }) => {
  const first = await question(page).textContent();
  const [topic] = await topicsOf(page);
  await tap(page, await centre(page));
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await settled(page);

  await page.getByRole("button", { name: new RegExp(`^${topic}, \\d+ cards?$`) }).tap();

  await expect(announcer(page)).not.toHaveText("Card 1 of 9");
  await expect(announcer(page)).toHaveText(/^Card 1 of \d$/);
  await expect(question(page)).toHaveText(first ?? "");
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
});

test("a change that drops the card on screen deals a fresh pass, front up", async ({ page }) => {
  const first = await question(page).textContent();
  const topics = await topicsOf(page);
  const other = ["Redis", "Postgres", "Queues", "Consistency", "Sharding", "Real-time", "Case studies"].find(
    (t) => !topics.includes(t),
  );
  await tap(page, await centre(page));
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await settled(page);

  await page.getByRole("button", { name: new RegExp(`^${other}, \\d+ cards?$`) }).tap();

  await expect(announcer(page)).toHaveText(/^Card 1 of \d$/);
  await expect(question(page)).not.toHaveText(first ?? "");
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
  expect(await topicsOf(page)).toContain(other);
});

test("the selection outlives a reload", async ({ page }) => {
  await chip(page, "Queues, 3 cards").tap();
  await chip(page, "Redis, 2 cards").tap();
  await expect(announcer(page)).toHaveText("Card 1 of 5");

  await page.reload();
  await firstCard(page);

  await expect(chip(page, "Queues, 3 cards")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "Redis, 2 cards")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "All, 9 cards")).toHaveAttribute("aria-pressed", "false");
  await expect(announcer(page)).toHaveText("Card 1 of 5");
});
