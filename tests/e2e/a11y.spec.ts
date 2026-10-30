import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  animated,
  announcer,
  centre,
  expect,
  firstCard,
  flipper,
  layer,
  question,
  settled,
  tap,
  test,
} from "./helpers";

// Accessibility (docs/plan.md §12): axe finds nothing in any state of the screen; the keys alone read the deck, with
// the focus always in sight; one live region says where you are; under reduced motion only opacity animates.

const project = () => test.info().project.name;

// Every WCAG 2.2 A and AA rule axe has. Its colour-contrast rule sees nothing on this page: a gradient or a
// pseudo-element lies behind every piece of text, so it reports each one incomplete, never failing. Contrast is
// checked over the tokens instead, in src/styles/contrast.test.ts.
async function axe(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  return violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join("; ")})`);
}

test.describe("axe", () => {
  test.beforeEach(() => {
    test.skip(project() !== "pixel11", "the Pixel 11");
  });

  async function open(page: Page) {
    await page.goto("/");
    await firstCard(page);
    await settled(page);
  }

  test("finds nothing on the front of a card", async ({ page }) => {
    await open(page);
    expect(await axe(page)).toEqual([]);
  });

  test("finds nothing on the back of a card", async ({ page }) => {
    await open(page);
    await tap(page, await centre(page));
    await expect(flipper(page)).toHaveAttribute("data-side", "back");
    await settled(page);
    expect(await axe(page)).toEqual([]);
  });

  test("finds nothing on the end card", async ({ page }) => {
    await open(page);
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press("l");
      await settled(page);
    }
    await expect(layer(page).getByText("That's all 9.")).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test("finds nothing with topics selected", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Redis, 2 cards", exact: true }).tap();
    await page.getByRole("button", { name: "Sharding, 2 cards", exact: true }).tap();
    await expect(announcer(page)).toHaveText("Card 1 of 4");
    await settled(page);
    expect(await axe(page)).toEqual([]);
  });

  test("finds nothing while the deck is on its way", async ({ page }) => {
    // Held: neither the preload nor the app's own request is ever answered.
    await page.route("**/api/cards", () => {});
    await page.goto("/");
    await expect(page.getByText("shuffling…")).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test("finds nothing when the deck can't be fetched", async ({ page }) => {
    await page.route("**/api/cards", (route) => route.abort());
    await page.goto("/");
    // Three tries with TanStack Query's backoff (1 s, then 2 s) before the error card.
    await expect(page.getByRole("button", { name: "Can't reach the deck. Tap to try again" })).toBeVisible({
      timeout: 15_000,
    });
    expect(await axe(page)).toEqual([]);
  });
});

test("one live region says where you are, politely, as you read", async ({ page }) => {
  test.skip(project() !== "pixel11", "the Pixel 11");
  await page.goto("/");
  await firstCard(page);
  await expect(page.locator("[aria-live]")).toHaveCount(1);
  await expect(announcer(page)).toHaveAttribute("aria-live", "polite");
  await expect(announcer(page)).toHaveText("Card 1 of 9");

  await page.keyboard.press("l");
  await expect(announcer(page)).toHaveText("Card 2 of 9");
  await page.keyboard.press("k");
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await expect(announcer(page)).toHaveText("Card 2 of 9");
});

// Where the focus is, and whether it shows: a 3 px highlighter ring, on a control that is on screen and unclipped.
function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || el === document.body) return null;
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return {
      name: el.getAttribute("aria-label") ?? el.textContent ?? "",
      ring: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
      shown:
        el.checkVisibility() &&
        style.clipPath === "none" &&
        box.left >= 0 &&
        box.top >= 0 &&
        box.right <= innerWidth &&
        box.bottom <= innerHeight,
    };
  });
}

test("the keys alone read the deck, the focus always in sight", async ({ page }) => {
  test.skip(project() === "portrait", "landscape");
  await page.goto("/");
  await firstCard(page);
  await settled(page);
  const first = await question(page).textContent();

  // Tab through the panel's chips to the card's buttons: every stop shows its ring.
  const stops: string[] = [];
  for (let i = 0; i < 12 && stops.at(-1) !== "Show answer"; i++) {
    await page.keyboard.press("Tab");
    const focus = await focusRing(page);
    expect(focus, `tab ${i + 1}`).toMatchObject({ ring: "solid 3px rgb(255, 240, 77)", shown: true });
    stops.push(focus?.name ?? "");
  }
  expect(stops).toEqual([
    "Full screen",
    "All, 9 cards",
    ...["Redis, 2", "Postgres, 3", "Queues, 3", "Consistency, 1", "Sharding, 2", "Real-time, 2", "Case studies, 2"].map(
      (chip) => `${chip} card${chip.endsWith(" 1") ? "" : "s"}`,
    ),
    "Show answer",
  ]);

  await page.keyboard.press("Enter");
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await expect(await focusRing(page)).toMatchObject({ name: "Show question", shown: true });

  await page.keyboard.press("Tab");
  await expect(await focusRing(page)).toMatchObject({ name: "Next", shown: true });
  await page.keyboard.press("Enter");
  await expect(announcer(page)).toHaveText("Card 2 of 9");
  await settled(page);
  await expect(await focusRing(page)).toMatchObject({ name: "Next", shown: true });

  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(await focusRing(page)).toMatchObject({ name: "Previous", shown: true });
  await page.keyboard.press("Enter");
  await expect(announcer(page)).toHaveText("Card 1 of 9");
  await expect(question(page)).toHaveText(first ?? "");
});

test("under reduced motion only opacity animates: the flip, a move and a deal fade", async ({ page }) => {
  test.skip(project() !== "pixel11", "the Pixel 11");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await firstCard(page);
  await settled(page);

  await tap(page, await centre(page));
  expect(await animated(page)).toEqual(["opacity"]);
  await settled(page);
  await page.keyboard.press("l");
  expect(await animated(page)).toEqual(["opacity"]);
  await settled(page);
  await page.keyboard.press("s");
  expect(await animated(page)).toEqual(["opacity"]);
  await settled(page);
});
