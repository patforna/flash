import type { Page } from "@playwright/test";
import type { Deck } from "../../shared/types";
import { centre, expect, finger, firstCard, fullscreen, insets, layer, settled, test } from "./helpers";

// The desk's geometry (docs/plan.md §2): nothing scrolls sideways, every control is big enough for a thumb, the card
// keeps clear of the strip the Android back gesture owns, a camera cutout covers nothing, and fullscreen shows the
// cards alone. On the Pixel 11 the page is fullscreen first, as the installed app is, except where the panel is what
// is checked: that shows in a tab.

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
// until they are focused, so they don't count.
function controls(page: Page) {
  return page.getByRole("button").evaluateAll((buttons) =>
    buttons
      .filter((el) => el.checkVisibility() && getComputedStyle(el).clipPath === "none")
      .map((el) => {
        const { width, height } = el.getBoundingClientRect();
        return { name: el.getAttribute("aria-label") ?? el.textContent, width, height };
      }),
  );
}

const tooSmall = (shown: Awaited<ReturnType<typeof controls>>) =>
  shown.filter(({ width, height }) => width < 44 || height < 44);

for (const [deck, baseURL] of [
  ["fixture", "http://127.0.0.1:4173"],
  ["real", "http://127.0.0.1:4174"],
] as const) {
  test(`every visible control is at least 44 × 44 px (${deck} deck)`, async ({ page }) => {
    test.skip(project() === "laptop", "a fine pointer");
    await open(page, { baseURL, fullscreen: false });
    const shown = await controls(page);
    // All and a chip for each of the deck's topics, at least.
    const { topics }: Deck = await (await page.request.get(`${baseURL}/api/cards`)).json();
    expect(shown.length).toBeGreaterThan(topics.length);
    expect(tooSmall(shown)).toEqual([]);
  });
}

test("a topic of two letters still gets a 44 px chip", async ({ page }) => {
  test.skip(project() === "laptop", "a fine pointer");
  // The deck rules allow a label of one character: the fixture deck as served, with Redis renamed Go.
  await page.route("**/api/cards", async (route) => {
    const deck = await (await route.fetch()).json();
    const rename = (topic: string) => (topic === "Redis" ? "Go" : topic);
    deck.topics = deck.topics.map(rename);
    for (const card of deck.cards) card.topics = card.topics.map(rename);
    await route.fulfill({ json: deck });
  });
  await open(page, { fullscreen: false });

  const shown = await controls(page);
  expect(shown.map((control) => control.name)).toContain("Go, 2 cards");
  expect(tooSmall(shown)).toEqual([]);
});

test("the card keeps 48 px clear of the right edge, where the back gesture starts", async ({ page }) => {
  test.skip(project() === "portrait", "portrait is a browser tab, with 16 px gutters");
  await open(page);
  const box = await layer(page).boundingBox();
  const width = await page.evaluate(() => innerWidth);
  expect(width - ((box?.x ?? 0) + (box?.width ?? 0))).toBeGreaterThanOrEqual(48);
});

// The panel stands beside the card: its first chip level with the card's top edge, the wordmark's letters standing on
// the line of its foot.
async function besideTheCard(page: Page) {
  const card = await layer(page).boundingBox();
  // Where the chip is laid out: a selected chip is tilted, which grows its bounding box.
  const chip = await page
    .getByRole("group", { name: "Topics" })
    .getByRole("button")
    .first()
    .evaluate((el) => (el as HTMLElement).offsetTop);
  // The wordmark's baseline, where an empty inline block sits.
  const baseline = await page.getByText("flash", { exact: true }).evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.display = "inline-block";
    el.append(probe);
    const y = probe.getBoundingClientRect().bottom;
    probe.remove();
    return y;
  });
  if (!card) throw new Error("no card");
  expect(Math.abs(chip - card.y), `the first chip at ${chip}, the card at ${card.y}`).toBeLessThanOrEqual(1);
  const foot = card.y + card.height;
  expect(
    Math.abs(baseline - foot),
    `the wordmark stands at ${baseline}, the card's foot at ${foot}`,
  ).toBeLessThanOrEqual(1);
}

test("the panel stands beside the card, from its top edge to its foot", async ({ page }) => {
  test.skip(project() === "portrait", "portrait stacks the card over the chips");
  await open(page, { fullscreen: false });
  await besideTheCard(page);
});

// Fullscreen is for reading: the panel and the wordmark go, the card is centred on the desk, and the one control left
// is a tab's way back out, where the fullscreen chip that brought it here was.
test("fullscreen shows the cards alone, the exit chip top left, level with the card, bringing the tab back", async ({
  page,
}) => {
  test.skip(project() === "portrait", "landscape");
  await open(page, { fullscreen: true });
  await expect(page.getByRole("group", { name: "Topics" })).toBeHidden();
  await expect(page.getByText("flash", { exact: true })).toBeHidden();
  const shown = await controls(page);
  // The one control on the desk; a fine pointer also has the stage's ‹ and › waiting at the card's edges.
  if (project() === "pixel11") expect(shown.map((control) => control.name)).toEqual(["Exit full screen"]);
  else expect(shown.map((control) => control.name)).toContain("Exit full screen");
  expect(tooSmall(shown)).toEqual([]);
  const exit = page.getByRole("button", { name: "Exit full screen" });
  const [chip, card] = await Promise.all([exit.boundingBox(), layer(page).boundingBox()]);
  if (!chip || !card) throw new Error("no chip or no card");
  expect(Math.abs(chip.y - card.y), `the chip at ${chip.y}, the card at ${card.y}`).toBeLessThanOrEqual(1);
  expect(chip.x + chip.width, "beside the card, not on it").toBeLessThan(card.x);

  await exit.click();

  await expect.poll(() => page.evaluate(() => matchMedia("(display-mode: fullscreen)").matches)).toBe(false);
  await expect(page.getByRole("group", { name: "Topics" })).toBeVisible();
  await expect(exit).toHaveCount(0);
});

test.describe("on the Pixel 11 with a camera cutout", () => {
  test.beforeEach(() => {
    test.skip(project() !== "pixel11", "the phone's safe areas");
  });

  test("a 40 px cutout on the left: the card narrows, and the panel still stands beside it", async ({ page }) => {
    await open(page, { fullscreen: false });
    await insets(page, { left: 40 });
    await expect.poll(() => page.locator("main").evaluate((el) => getComputedStyle(el).paddingLeft)).toBe("48px");
    await settled(page);
    await besideTheCard(page);
  });

  // Fullscreen pads the desk by the exit chip's column too (44 px and the 24 px gap).
  const aside = 44 + 24;

  test("a 40 px cutout on the left covers nothing", async ({ page }) => {
    await open(page);
    await insets(page, { left: 40 });
    await expect
      .poll(() => page.locator("main").evaluate((el) => getComputedStyle(el).paddingLeft))
      .toBe(`${48 + aside}px`);
    await settled(page);

    const under = await page.locator("main").evaluate((main) =>
      Array.from(main.querySelectorAll("*"))
        .filter((el) => el.checkVisibility() && el.getBoundingClientRect().width > 0)
        .filter((el) => el.getBoundingClientRect().left < 40)
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
