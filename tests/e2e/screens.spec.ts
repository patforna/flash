import type { Page } from "@playwright/test";
import {
  announcer,
  controls,
  expect,
  firstCard,
  flipper,
  fullscreen,
  insets,
  openTopics,
  question,
  revealControls,
  row,
  settled,
  shuffling,
  test,
} from "./helpers";

// The screenshot baselines (docs/plan.md §12), in tests/screenshots/<project>/. On the Pixel 11 the page is
// fullscreen first, as the installed app is, and at rest: the controls have faded after launch (the end card brings
// them back). Loading and error come before there is a stage to take the f key. The seeded shuffle puts the same
// cards in the same places every run.

const project = () => test.info().project.name;

async function open(page: Page, { fullscreen: full = project() === "pixel11" } = {}) {
  await page.goto("/");
  await firstCard(page);
  if (full) await fullscreen(page);
  await settled(page);
  // The controls have gone, and their fade with them.
  await expect(controls(page)).toHaveCount(0, { timeout: 5000 });
  const column = page.getByRole("button", { name: /^Topics/ }).locator("..");
  await expect.poll(() => column.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
}

// Deals with l until the card on top asks `wanted`.
async function goTo(page: Page, wanted: RegExp) {
  for (let i = 0; i < 9 && !wanted.test((await question(page).textContent()) ?? ""); i++) {
    await page.keyboard.press("l");
    await settled(page);
  }
  await expect(question(page)).toHaveText(wanted);
}

async function turnOver(page: Page) {
  await page.keyboard.press("k");
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await settled(page);
}

test.describe("the Pixel 11", () => {
  test.beforeEach(() => {
    test.skip(project() !== "pixel11", "the Pixel 11");
  });

  test("front", async ({ page }) => {
    await open(page);
    await expect(page).toHaveScreenshot("front.png");
  });

  test("back with a list and inline code", async ({ page }) => {
    await open(page);
    await goTo(page, /VACUUM/);
    await turnOver(page);
    await expect(page).toHaveScreenshot("back-list.png");
  });

  test("back with a code block", async ({ page }) => {
    await open(page);
    await goTo(page, /without blocking each other/);
    await turnOver(page);
    await expect(page).toHaveScreenshot("back-code.png");
  });

  test("back at the smallest type step", async ({ page }) => {
    await open(page);
    await goTo(page, /shard key/);
    await turnOver(page);
    await expect(flipper(page).locator("> :nth-child(2)")).toHaveAttribute("data-fit", "2");
    await expect(page).toHaveScreenshot("back-step-2.png");
  });

  test("end card", async ({ page }) => {
    await open(page);
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press("l");
      await settled(page);
    }
    await expect(announcer(page)).toHaveText("That’s all 9. Tap or swipe to shuffle again.");
    await expect(page).toHaveScreenshot("end.png");
  });

  test("loading", async ({ page }) => {
    await page.route("**/api/cards", () => {});
    await page.goto("/");
    await expect(shuffling(page)).toBeVisible();
    await page.evaluate(() =>
      Promise.all([document.fonts.load('1em "Klee One"'), document.fonts.load('1em "Covered By Your Grace"')]),
    );
    await expect(page).toHaveScreenshot("loading.png");
  });

  test("error", async ({ page }) => {
    await page.route("**/api/cards", (route) => route.abort());
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Can’t reach the deck. Tap to try again" })).toBeVisible({
      timeout: 15_000,
    });
    await page.evaluate(() =>
      Promise.all([document.fonts.load('1em "Klee One"'), document.fonts.load('1em "Covered By Your Grace"')]),
    );
    await expect(page).toHaveScreenshot("error.png");
  });

  test("the topic drawer, three topics selected", async ({ page }) => {
    await open(page);
    await openTopics(page);
    for (const name of ["Redis 2 cards", "Postgres 3 cards", "Real-time 2 cards"]) await row(page, name).tap();
    await expect(announcer(page)).toHaveText(/ of 7$/);
    await settled(page);
    await expect(page).toHaveScreenshot("topics.png");
  });

  test("the controls, revealed by a tap on the desk", async ({ page }) => {
    await open(page);
    await revealControls(page);
    await settled(page);
    await expect(page).toHaveScreenshot("controls.png");
  });

  test("a 40 px camera cutout on the left", async ({ page }) => {
    await open(page);
    await insets(page, { left: 40 });
    // 48 px past the cutout, and fullscreen's room for the exit chip's column (44 px and the 24 px gap).
    await expect.poll(() => page.locator("main").evaluate((el) => getComputedStyle(el).paddingLeft)).toBe("116px");
    await settled(page);
    await expect(page).toHaveScreenshot("camera-cutout.png");
  });
});

test("portrait: front", async ({ page }) => {
  test.skip(project() !== "portrait", "portrait");
  await open(page);
  await expect(page).toHaveScreenshot("front.png");
});

test("laptop: back", async ({ page }) => {
  test.skip(project() !== "laptop", "the laptop");
  await open(page);
  await turnOver(page);
  await expect(page).toHaveScreenshot("back.png");
});
