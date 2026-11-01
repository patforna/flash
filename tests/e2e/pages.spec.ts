import { announcer, centre, expect, firstCard, flick, flipper, question, settled, tap, test } from "./helpers";

// Answers over several pages (variant B: a tap turns the pages). The fixture's VACUUM card has three: a tap on the
// back turns to the next page, the last page's tap turns to the question, a pencil count says where you are, ↑ goes
// back a page, and a swipe from any page changes cards, the next one front up.

test.beforeEach(async ({ page }) => {
  test.skip(test.info().project.name !== "pixel11", "taps, on the Pixel 11");
  await page.goto("/");
  await firstCard(page);
  await settled(page);
  // Deals with l until the VACUUM card is on top.
  for (let i = 0; i < 9 && !/VACUUM/.test((await question(page).textContent()) ?? ""); i++) {
    await page.keyboard.press("l");
    await settled(page);
  }
  await expect(question(page)).toHaveText(/VACUUM/);
});

const shown = (page: import("@playwright/test").Page) => flipper(page).locator("[data-current]");
const count = (page: import("@playwright/test").Page) => flipper(page).locator("> :nth-child(2) > span");
const turn = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /Show answer|Next page|Show question/ });

test("three taps walk the pages, counted in pencil, and the fourth shows the question", async ({ page }) => {
  await tap(page, await centre(page));
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await expect(shown(page)).toContainText("MVCC never changes a row in place");
  await expect(count(page)).toHaveText("1/3");
  await expect(turn(page)).toHaveText("Next page");
  await expect(announcer(page)).toHaveText(/^Card \d of 9$/);
  await settled(page);

  await tap(page, await centre(page));
  await expect(shown(page)).toContainText("Page two");
  await expect(count(page)).toHaveText("2/3");
  await expect(announcer(page)).toHaveText(/^Card \d of 9, page 2 of 3$/);
  // A page turns without the card turning: no 3D flip under way.
  expect(await page.locator("[data-flipping]").count()).toBe(0);

  await tap(page, await centre(page));
  await expect(shown(page)).toContainText("Page three");
  await expect(count(page)).toHaveText("3/3");
  await expect(turn(page)).toHaveText("Show question");

  await tap(page, await centre(page));
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
  await expect(announcer(page)).toHaveText(/^Card \d of 9$/);
});

test("↑ goes back a page; on page 1 it turns the card to the question", async ({ page }) => {
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await expect(count(page)).toHaveText("2/3");

  await page.keyboard.press("ArrowUp");
  await expect(count(page)).toHaveText("1/3");
  await expect(flipper(page)).toHaveAttribute("data-side", "back");

  await page.keyboard.press("k");
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
});

test("a swipe from page 2 changes cards, and the next card starts on its front, page 1", async ({ page }) => {
  await tap(page, await centre(page));
  await settled(page);
  await tap(page, await centre(page));
  await expect(count(page)).toHaveText("2/3");
  const before = await announcer(page).textContent();

  await flick(page, "left");
  await expect(announcer(page)).not.toHaveText(before ?? "");
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
  await expect(question(page)).not.toHaveText(/VACUUM/);
  await settled(page);

  // Back to the VACUUM card: it starts on its front again, page 1 when turned.
  await flick(page, "right");
  await expect(question(page)).toHaveText(/VACUUM/);
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
  await settled(page);
  await tap(page, await centre(page));
  await expect(count(page)).toHaveText("1/3");
});

test("a card with one page has no count, and its tap turns straight back to the question", async ({ page }) => {
  await page.keyboard.press("l");
  await settled(page);
  await expect(question(page)).not.toHaveText(/VACUUM/);
  await tap(page, await centre(page));
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await expect(count(page)).toHaveCount(0);
  await expect(turn(page)).toHaveText("Show question");
  await settled(page);
  await tap(page, await centre(page));
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
});
