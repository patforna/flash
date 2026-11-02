import type { Locator, Page } from "@playwright/test";
import {
  announcer,
  centre,
  expect,
  finger,
  firstCard,
  flipper,
  layer,
  question,
  settled,
  swipe,
  tap,
  test,
} from "./helpers";

// An answer of several pages (variant A): the back is one column that scrolls under a finger, its foot fading and an
// arrow showing while there is more below; a sideways swipe still changes cards from a scrolled back, and a tap
// still turns it over. The fixture's VACUUM card has three pages; every other card has one, and none of this.

test.beforeEach(async ({ page }) => {
  test.skip(test.info().project.name !== "pixel11", "a thumb, on the Pixel 11");
  await page.goto("/");
  await firstCard(page);
  await settled(page);
});

// Deals with l until the card on top asks `wanted`, then turns it over.
async function openBack(page: Page, wanted: RegExp) {
  for (let i = 0; i < 9 && !wanted.test((await question(page).textContent()) ?? ""); i++) {
    await page.keyboard.press("l");
    await settled(page);
  }
  await expect(question(page)).toHaveText(wanted);
  await tap(page, await centre(page));
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await settled(page);
}

const scroller = (page: Page): Locator => layer(page).locator("[data-scroll]");
const more = (page: Page): Locator => layer(page).locator('[data-pages] > [aria-hidden="true"]');
const scrollTop = (el: Locator) => el.evaluate((node) => node.scrollTop);
const canScroll = (el: Locator) => el.evaluate((node) => node.scrollHeight - node.clientHeight);
// How far up from the answer's foot its fade reaches, in px: where its mask turns opaque.
const fade = (el: Locator) =>
  el.evaluate((node) => Number(/([\d.]+)px\)$/.exec(getComputedStyle(node).maskImage)?.[1] ?? 0));
const opacity = (el: Locator) => el.evaluate((node) => Number(getComputedStyle(node).opacity));

test("the pages of a long answer scroll under a finger, the fade and the arrow showing while there is more", async ({
  page,
}) => {
  await openBack(page, /VACUUM/);
  const answer = scroller(page);
  await expect(answer).toHaveCount(1);
  expect(await canScroll(answer), "three pages overflow the card").toBeGreaterThan(100);
  await expect(layer(page).locator("[data-pages]")).toHaveAttribute("data-fit", "0");
  // At the top: the fade is 45 card units (364 px tall card: 45.5 px), the arrow shows.
  expect(await fade(answer)).toBeGreaterThan(40);
  expect(await opacity(more(page))).toBeGreaterThan(0.7);

  const at = await centre(page);
  const f = await finger(page, at);
  await f.move({ x: at.x, y: at.y - 150 }, 200);
  await f.up();
  await expect.poll(() => scrollTop(answer)).toBeGreaterThan(60);
  // Still on the back of the same card: the drag scrolled, it neither flipped nor moved the card.
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await expect(announcer(page)).toHaveText(/^Card \d of 9$/);

  // At the end: no fade, no arrow.
  await answer.evaluate((node) => node.scrollTo({ top: node.scrollHeight, behavior: "auto" }));
  await expect.poll(() => fade(answer)).toBe(0);
  await expect.poll(() => opacity(more(page))).toBe(0);
});

test("a sideways swipe from a scrolled back still changes cards, and a tap still turns it over", async ({ page }) => {
  await openBack(page, /VACUUM/);
  const answer = scroller(page);
  await answer.evaluate((node) => node.scrollTo({ top: 120, behavior: "auto" }));
  const before = (await announcer(page).textContent()) ?? "";
  const at = await centre(page);

  await tap(page, at);
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
  await settled(page);
  // Turned back over, it starts at the top again.
  await tap(page, at);
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await expect.poll(() => scrollTop(scroller(page))).toBe(0);
  await settled(page);
  await answer.evaluate((node) => node.scrollTo({ top: 120, behavior: "auto" }));

  await swipe(page, { from: at, to: { x: at.x - 300, y: at.y }, ms: 120 });
  await expect(announcer(page)).not.toHaveText(before);
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
});

test("↓ scrolls the back by 60 % of the card while it can, then flips; a one-page back flips at once", async ({
  page,
}) => {
  await openBack(page, /VACUUM/);
  const answer = scroller(page);
  const height = (await layer(page).boundingBox())?.height ?? 0;
  const step = Math.min(0.6 * height, await canScroll(answer));
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => scrollTop(answer)).toBeGreaterThan(step - 2);
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await answer.evaluate((node) => node.scrollTo({ top: node.scrollHeight, behavior: "auto" }));
  await page.keyboard.press("ArrowDown");
  await expect(flipper(page)).toHaveAttribute("data-side", "front");

  await page.keyboard.press("l");
  await settled(page);
  await tap(page, await centre(page));
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await expect(scroller(page)).toHaveCount(0);
  await page.keyboard.press("ArrowDown");
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
});

test("a one-page back has no scroller, no fade and no arrow", async ({ page }) => {
  await openBack(page, /SETNX/);
  await expect(scroller(page)).toHaveCount(0);
  await expect(more(page)).toHaveCount(0);
  await expect(layer(page).locator("[data-pages]")).toHaveCount(0);
});
