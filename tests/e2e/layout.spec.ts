import type { Page } from "@playwright/test";
import type { Deck } from "../../shared/types";
import {
  centre,
  closeTopics,
  controls,
  expect,
  finger,
  firstCard,
  fullscreen,
  insets,
  layer,
  openTopics,
  revealControls,
  settled,
  test,
} from "./helpers";

// The desk's geometry (docs/plan.md §2): nothing scrolls sideways, every control is big enough for a thumb, the card
// keeps clear of the strip the Android back gesture owns, a camera cutout covers nothing, the controls stand along the
// card's left edge and show only when asked for, and fullscreen has a way out. On the Pixel 11 the page is
// fullscreen first, as the installed app is.

const project = () => test.info().project.name;

async function open(page: Page, { baseURL = "/", fullscreen: full = project() === "pixel11" } = {}) {
  await page.goto(baseURL);
  await firstCard(page);
  if (full) await fullscreen(page);
  await settled(page);
}

const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("nothing scrolls sideways", async ({ page }) => {
  await open(page);
  expect(await sideways(page)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
});

test("nothing scrolls sideways while a card is dragged off the left of the screen", async ({ page }) => {
  test.skip(project() !== "pixel11", "a thumb, on the Pixel 11");
  await open(page);
  const at = await centre(page);
  const f = await finger(page, at);
  await f.move({ x: at.x - 500, y: at.y }, 400);
  await expect.poll(() => layer(page).evaluate((el) => el.style.transform)).toContain("translateX(-500px)");

  expect(await sideways(page)).toBe(0);
  await f.up();
});

// The controls on screen, each with its size. The stage's buttons for keyboards and screen readers stay clipped away
// until they are focused, so they don't count; the drawer's rows count only while it is open (closed, it is inert).
function shown(page: Page) {
  return page.getByRole("button").evaluateAll((buttons) =>
    buttons
      .filter(
        (el) => el.checkVisibility() && getComputedStyle(el).clipPath === "none" && el.closest("[inert]") === null,
      )
      .map((el) => {
        const { width, height } = el.getBoundingClientRect();
        return { name: el.getAttribute("aria-label") ?? el.textContent, width, height };
      }),
  );
}

const tooSmall = (buttons: Awaited<ReturnType<typeof shown>>) =>
  buttons.filter(({ width, height }) => width < 44 || height < 44);

for (const [deck, baseURL] of [
  ["fixture", "http://127.0.0.1:4173"],
  ["real", "http://127.0.0.1:4174"],
] as const) {
  test(`every visible control is at least 44 × 44 px (${deck} deck)`, async ({ page }) => {
    test.skip(project() === "laptop", "a fine pointer");
    await open(page, { baseURL });
    await openTopics(page);
    const buttons = await shown(page);
    // The two chips, All and a row for each of the deck's topics.
    const { topics }: Deck = await (await page.request.get(`${baseURL}/api/cards`)).json();
    expect(buttons).toHaveLength(topics.length + 3);
    expect(tooSmall(buttons)).toEqual([]);
  });
}

test("a topic of two letters still gets a 44 px row", async ({ page }) => {
  test.skip(project() === "laptop", "a fine pointer");
  // The deck rules allow a label of one character: the fixture deck as served, with Redis renamed Go.
  await page.route("**/api/cards", async (route) => {
    const deck = await (await route.fetch()).json();
    const rename = (topic: string) => (topic === "Redis" ? "Go" : topic);
    deck.topics = deck.topics.map(rename);
    for (const card of deck.cards) card.topics = card.topics.map(rename);
    await route.fulfill({ json: deck });
  });
  await open(page);
  await openTopics(page);

  const buttons = await shown(page);
  expect(buttons.map((control) => control.name)).toContain("Go 2 cards");
  expect(tooSmall(buttons)).toEqual([]);
});

test("the card keeps 48 px clear of the right edge, where the back gesture starts", async ({ page }) => {
  test.skip(project() === "portrait", "portrait is a browser tab, with 16 px gutters");
  await open(page);
  const box = await layer(page).boundingBox();
  const width = await page.evaluate(() => innerWidth);
  expect(width - ((box?.x ?? 0) + (box?.width ?? 0))).toBeGreaterThanOrEqual(48);
});

// The controls stand in a column along the card's left edge, clear of it: the fullscreen chip level with the card's
// top edge, the topics chip with its foot.
async function alongTheCard(page: Page) {
  const card = await layer(page).boundingBox();
  const top = await page
    .getByRole("button", { name: /full screen$/i })
    .first()
    .boundingBox();
  const foot = await page.getByRole("button", { name: /^Topics/ }).boundingBox();
  if (!card || !top || !foot) throw new Error("no card or no controls");
  expect(Math.abs(top.y - card.y), `the first control at ${top.y}, the card at ${card.y}`).toBeLessThanOrEqual(1);
  expect(
    Math.abs(foot.y + foot.height - (card.y + card.height)),
    `the last control ends at ${foot.y + foot.height}, the card at ${card.y + card.height}`,
  ).toBeLessThanOrEqual(1);
  expect(top.x + top.width, "beside the card, not on it").toBeLessThan(card.x);
}

test("the controls stand along the card's left edge, from its top to its foot", async ({ page }) => {
  test.skip(project() === "portrait", "portrait puts the controls under the card");
  await open(page);
  await alongTheCard(page);
});

// Reading is undisturbed: the controls show for a moment at launch, go, come back on a tap on the desk (not on the
// card), and go again as a card moves.
test("the controls fade out after launch, come back on a tap on the desk, and go as a card moves", async ({ page }) => {
  test.skip(project() !== "pixel11", "taps, on the Pixel 11");
  await open(page);
  await expect(controls(page)).toHaveCount(0, { timeout: 5000 });
  const column = page.getByRole("button", { name: /^Topics/ }).locator("..");
  await expect.poll(() => column.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");

  await revealControls(page);
  await expect.poll(() => column.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");

  await page.keyboard.press("l");
  await expect(controls(page)).toHaveCount(0);
});

test("fullscreen has a way out: the chip in the corner brings the tab back", async ({ page }) => {
  test.skip(project() === "portrait", "landscape");
  await open(page, { fullscreen: true });
  await revealControls(page);
  const exit = page.getByRole("button", { name: "Exit full screen", exact: true });
  await expect(exit).toBeVisible();
  await alongTheCard(page);

  await exit.click();

  await expect.poll(() => page.evaluate(() => matchMedia("(display-mode: fullscreen)").matches)).toBe(false);
  await expect(page.getByRole("button", { name: "Full screen", exact: true })).toBeVisible();
  await expect(exit).toHaveCount(0);
});

test("the drawer slides over the desk, and a tap beside it closes it", async ({ page }) => {
  test.skip(project() !== "pixel11", "taps, on the Pixel 11");
  await open(page);
  const drawer = await openTopics(page);
  const box = await drawer.boundingBox();
  if (!box) throw new Error("no drawer");
  expect(box.x).toBe(0);
  expect(box.height).toBe(412);

  await closeTopics(page, "tap");
  await expect(drawer).not.toHaveAttribute("data-open", "");
});

test.describe("on the Pixel 11 with a camera cutout", () => {
  test.beforeEach(() => {
    test.skip(project() !== "pixel11", "the phone's safe areas");
  });

  // Fullscreen pads the desk by the controls' column too (44 px and the 24 px gap).
  const aside = 44 + 24;

  test("a 40 px cutout on the left: the card narrows, and the controls still stand along it", async ({ page }) => {
    await open(page);
    await insets(page, { left: 40 });
    await expect
      .poll(() => page.locator("main").evaluate((el) => getComputedStyle(el).paddingLeft))
      .toBe(`${48 + aside}px`);
    await settled(page);
    await alongTheCard(page);
  });

  test("a 40 px cutout on the left covers nothing", async ({ page }) => {
    await open(page);
    await insets(page, { left: 40 });
    await expect
      .poll(() => page.locator("main").evaluate((el) => getComputedStyle(el).paddingLeft))
      .toBe(`${48 + aside}px`);
    await settled(page);

    // Whatever is on screen (the closed drawer waits off it, inert) and reaches under the cutout.
    const under = await page.locator("main").evaluate((main) =>
      Array.from(main.querySelectorAll("*"))
        .filter((el) => el.checkVisibility() && el.closest("[inert]") === null && getComputedStyle(el).opacity !== "0")
        .filter((el) => {
          const { left, right, width } = el.getBoundingClientRect();
          return width > 0 && right > 0 && left < 40;
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(under).toEqual([]);
  });

  test("a 40 px cutout on the right moves the card to keep 16 px beyond it", async ({ page }) => {
    await open(page);
    await insets(page, { right: 40 });
    await expect
      .poll(() => page.locator("main").evaluate((el) => getComputedStyle(el).paddingRight))
      .toBe(`${56 + aside}px`);
    await settled(page);

    const box = await layer(page).boundingBox();
    const width = await page.evaluate(() => innerWidth);
    expect(width - ((box?.x ?? 0) + (box?.width ?? 0))).toBeGreaterThanOrEqual(56);
  });
});
