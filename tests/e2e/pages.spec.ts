import type { Page } from "@playwright/test";
import {
  animated,
  announcer,
  centre,
  expect,
  finger,
  firstCard,
  flipper,
  layer,
  question,
  settled,
  tap,
  test,
} from "./helpers";

// The pages of an answer (the long-answer exploration, variant C): on the back of the fixture's VACUUM card, which runs
// over three pages, the next page's sheet peeks out under the card's foot; a swipe up pulls it over, a swipe down
// brings the page before back, a tap turns to the question from any page, and a swipe left changes cards from any
// page. The sheets move on the compositor alone.

test.beforeEach(async ({ page }) => {
  test.skip(test.info().project.name !== "pixel11", "touch, on the Pixel 11");
  await page.goto("/");
  await firstCard(page);
  await settled(page);
  for (let i = 0; i < 9 && !/VACUUM/.test((await question(page).textContent()) ?? ""); i++) {
    await page.keyboard.press("l");
    await settled(page);
  }
  await expect(question(page)).toHaveText(/VACUUM/);
  await tap(page, await centre(page));
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await settled(page);
});

const sheet = (page: Page, pos: "current" | "next" | "prev") => layer(page).locator(`[data-pos="${pos}"]`);
// "Card 5 of 9": where the VACUUM card fell in the seeded pass.
const where = async (page: Page) => (((await announcer(page).textContent()) ?? "").match(/^Card \d+ of 9/) ?? [""])[0];

test("the next page's sheet peeks out under the card's foot, 12 units of it", async ({ page }) => {
  const card = await layer(page).boundingBox();
  const next = await sheet(page, "next").boundingBox();
  if (!card || !next) throw new Error("no card or no sheet");
  const peek = (12 * card.height) / 360;
  expect(Math.abs(next.y + next.height - (card.y + card.height) - peek)).toBeLessThanOrEqual(1);
  expect(Math.abs(next.y - (card.y + peek))).toBeLessThanOrEqual(1);
  await expect(sheet(page, "current")).toContainText("MVCC");
  await expect(sheet(page, "prev")).toHaveCount(0);
});

test("a swipe up pulls the next page over: the sheet follows from its first moved pixel, and the page turns", async ({
  page,
}) => {
  const at = await centre(page);
  const card = await where(page);
  const f = await finger(page, at);
  await f.move({ x: at.x, y: at.y - 30 }, 24);
  await expect.poll(() => sheet(page, "current").evaluate((el) => el.style.transform)).toBe("translateY(-30px)");
  await f.move({ x: at.x, y: at.y - 160 }, 80);
  await f.up();

  await expect(announcer(page)).toHaveText(`${card}, page 2 of 3`);
  await settled(page);
  await expect(sheet(page, "current")).toContainText("Page two");
  await expect(sheet(page, "prev")).toContainText("MVCC");
  await expect(sheet(page, "next")).toContainText("Page three");
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
});

test("a short, slow drag springs the sheets back", async ({ page }) => {
  const at = await centre(page);
  const card = await where(page);
  const f = await finger(page, at);
  await f.move({ x: at.x, y: at.y - 40 }, 400);
  await f.up();
  await settled(page);
  await expect(announcer(page)).toHaveText(card);
  await expect(sheet(page, "current")).toContainText("MVCC");
  expect(await sheet(page, "current").evaluate((el) => el.style.transform)).toBe("");
});

test("a swipe down brings the page before back; a tap on the last page turns to the question", async ({ page }) => {
  const at = await centre(page);
  const card = await where(page);
  await page.keyboard.press("ArrowDown");
  await settled(page);
  await page.keyboard.press("ArrowDown");
  await settled(page);
  await expect(announcer(page)).toHaveText(`${card}, page 3 of 3`);

  const f = await finger(page, at);
  await f.move({ x: at.x, y: at.y + 160 }, 80);
  await f.up();
  await expect(announcer(page)).toHaveText(`${card}, page 2 of 3`);
  await settled(page);

  await page.keyboard.press("ArrowDown");
  await settled(page);
  await tap(page, await centre(page));
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
  await expect(announcer(page)).toHaveText(card);
  await settled(page);
  // Turned over again, the back opens on page 1.
  await tap(page, await centre(page));
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await expect(sheet(page, "current")).toContainText("MVCC");
});

test("a swipe left from a later page changes cards, front up", async ({ page }) => {
  const at = await centre(page);
  await page.keyboard.press("ArrowDown");
  await settled(page);
  const f = await finger(page, at);
  await f.move({ x: at.x - 300, y: at.y }, 120);
  await f.up();
  await expect(announcer(page)).toHaveText(/^Card \d+ of 9$/);
  await settled(page);
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
  await expect(question(page)).not.toHaveText(/VACUUM/);
});

test("while a page turns, only transform and opacity animate", async ({ page }) => {
  const at = await centre(page);
  const f = await finger(page, at);
  await f.move({ x: at.x, y: at.y - 160 }, 80);
  await f.up();
  const properties = await animated(page);
  expect(properties.length, "something runs").toBeGreaterThan(0);
  expect(
    properties.every((p) => p === "transform" || p === "opacity"),
    properties.join(", "),
  ).toBe(true);
});
