import type { Page } from "@playwright/test";
import {
  announcer,
  centre,
  expect,
  finger,
  firstCard,
  flick,
  flipper,
  layer,
  question,
  questions,
  settled,
  swipe,
  tap,
  test,
  underneathWhile,
} from "./helpers";

// Reading with a thumb (docs/plan.md §4 and §5): a tap turns the card over, a swipe left deals the next one, a swipe
// right brings back the previous one, and the end card closes the pass. The fixture deck holds 9 cards.

test.beforeEach(async ({ page }) => {
  test.skip(test.info().project.name !== "pixel11", "touch, on the Pixel 11");
  await page.goto("/");
  await firstCard(page);
  await settled(page);
});

// The inline transform the gesture wrote on the card on top ("" at rest).
const dragged = (page: Page) => layer(page).evaluate((el) => el.style.transform);

test("the first card shows one of the deck's questions, front up", async ({ page }) => {
  await expect(question(page)).toBeVisible();
  expect(await questions(page)).toContain(await question(page).textContent());
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
  await expect(announcer(page)).toHaveText("Card 1 of 9");
});

// Whether the card underneath shows its question.
const writingUnderneath = (page: Page) =>
  question(page, "next").evaluate((el) => el.checkVisibility({ visibilityProperty: true }));

test("a tap turns the card over to its answer", async ({ page }) => {
  await tap(page, await centre(page));
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  // Near 90° the card turning is almost edge-on: the card underneath is blank paper meanwhile. Its easing reaches 90°
  // within a sixth of its time and lies flat by half of it.
  const frames = await underneathWhile(page, '[data-role="current"] [data-side]', 0.5);
  expect(frames.length, "frames in the first half of the turn").toBeGreaterThanOrEqual(3);
  expect(frames.filter((shown) => shown).length, "of them, frames showing the question underneath").toBe(0);

  const [front, back] = [flipper(page).locator("> :first-child"), flipper(page).locator("> :nth-child(2)")];
  await expect(front).toHaveAttribute("aria-hidden", "true");
  await expect(back).not.toHaveAttribute("aria-hidden");
  await expect(back.locator("h2")).toHaveText((await question(page).textContent()) ?? "");
  await expect(back.locator("h2 + div")).not.toBeEmpty();
  await settled(page);
  expect(await writingUnderneath(page)).toBe(true);
});

test("a swipe left deals the next card, front up", async ({ page }) => {
  const next = await question(page, "next").textContent();

  await flick(page, "left");

  await expect(question(page)).toHaveText(next ?? "");
  await expect(announcer(page)).toHaveText("Card 2 of 9");
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
});

test("a swipe right brings back the previous card, front up", async ({ page }) => {
  const first = await question(page).textContent();
  await flick(page, "left");
  await expect(announcer(page)).toHaveText("Card 2 of 9");
  await settled(page);
  await tap(page, await centre(page));
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await settled(page);

  await flick(page, "right");

  await expect(question(page)).toHaveText(first ?? "");
  await expect(announcer(page)).toHaveText("Card 1 of 9");
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
});

test("on the first card a swipe right only stretches, and the card settles back", async ({ page }) => {
  const first = await question(page).textContent();
  const at = await centre(page);
  const f = await finger(page, at);
  await f.move({ x: at.x + 200, y: at.y }, 400);

  // The rubber band: 80·(1 − 1/(0.55·200/80 + 1)) ≈ 46 px for the thumb's 200, never the 80 px limit.
  await expect.poll(() => dragged(page)).toMatch(/^translateX\(46\.31\d*px\)/);

  await f.up();
  await settled(page);
  await expect(question(page)).toHaveText(first ?? "");
  expect(await dragged(page)).toBe("");
});

test("a short, slow drag follows the thumb, then cancels and settles back", async ({ page }) => {
  const first = await question(page).textContent();
  const box = await layer(page).boundingBox();
  const at = await centre(page);
  const f = await finger(page, at);
  await f.move({ x: at.x - 60, y: at.y }, 400);
  // 1:1 with the thumb, tilted 0.03° a pixel. (Moves reach the page on the next frame, after CDP has answered.)
  await expect.poll(() => dragged(page)).toBe("translateX(-60px) rotate(-1.8deg)");

  await f.up();
  await settled(page);

  await expect(question(page)).toHaveText(first ?? "");
  await expect(announcer(page)).toHaveText("Card 1 of 9");
  expect(await dragged(page)).toBe("");
  expect(await layer(page, "next").evaluate((el) => el.style.transform)).toBe("");
  expect(await layer(page).boundingBox()).toEqual(box);
});

test("a fling back against the drag cancels, even past the commit distance", async ({ page }) => {
  const first = await question(page).textContent();
  const at = await centre(page);
  const f = await finger(page, at);
  // Slowly past 28 % of the card's width (about 170 px), then flung back: released 220 px out, moving right fast.
  await f.move({ x: at.x - 320, y: at.y }, 640);
  await f.move({ x: at.x - 220, y: at.y }, 48);
  await f.up();
  await settled(page);

  await expect(question(page)).toHaveText(first ?? "");
  await expect(announcer(page)).toHaveText("Card 1 of 9");
  expect(await dragged(page)).toBe("");
});

test("three rapid flicks advance exactly three cards, each dragging the card then on top", async ({ page }) => {
  // Which card each drag moved: the question in the top layer whenever a drag writes a translation to it.
  await page.evaluate(() => {
    const log: string[] = [];
    Object.assign(window, { draggedCards: log });
    const top = document.querySelector<HTMLElement>('[data-role="current"]');
    if (!top) throw new Error("no stage");
    new MutationObserver(() => {
      const x = /translateX\((-?[\d.]+)px\)/.exec(top.style.transform)?.[1];
      if (x && Number(x) !== 0) log.push(top.querySelector("h2")?.textContent ?? "end");
    }).observe(top, { attributes: true, attributeFilter: ["style"] });
  });
  // The cards dragged since the last look, and whether a card is still flying out (the next flick must start then).
  const takeLog = () =>
    page.evaluate(() => ({
      cards: [...new Set((window as unknown as { draggedCards: string[] }).draggedCards.splice(0))],
      flying: document.getAnimations().length > 0,
    }));
  const first = await question(page).textContent();
  const second = await question(page, "next").textContent();
  // Every flick starts where the cards rest: mid-fling, the top layer is on its way off the screen.
  const at = await centre(page);
  const quick = () => swipe(page, { from: at, to: { x: at.x - 160, y: at.y }, ms: 48 });

  await quick();
  expect(await takeLog()).toEqual({ cards: [first], flying: true });
  await quick();
  expect(await takeLog()).toEqual({ cards: [second], flying: true });
  await quick();
  const { cards: third } = await takeLog();

  expect(third).toHaveLength(1);
  expect([first, second]).not.toContain(third[0]);
  await expect(announcer(page)).toHaveText("Card 4 of 9");
  await settled(page);
  expect([first, second, ...third]).not.toContain(await question(page).textContent());
});

test("past the last card comes the end card; a tap on it deals a new pass that doesn't start with the card just seen", async ({
  page,
}) => {
  for (let position = 2; position <= 9; position++) {
    await flick(page, "left");
    await expect(announcer(page)).toHaveText(`Card ${position} of 9`);
    await settled(page);
  }
  const last = await question(page).textContent();

  await flick(page, "left");
  await expect(announcer(page)).toHaveText("That's all 9. Tap or swipe to shuffle again.");
  await expect(layer(page).getByText("That's all 9.")).toBeVisible();
  await settled(page);
  // A swipe right from the end card goes back to the last card, and a swipe left returns to the end card.
  await flick(page, "right");
  await expect(question(page)).toHaveText(last ?? "");
  await settled(page);
  await flick(page, "left");
  await expect(announcer(page)).toHaveText("That's all 9. Tap or swipe to shuffle again.");
  await settled(page);

  await tap(page, await centre(page));

  await expect(announcer(page)).toHaveText("Card 1 of 9");
  // The new card fades in over the one underneath, which is blank paper until it has landed.
  const frames = await underneathWhile(page, '[data-role="current"]');
  expect(frames.length, "frames of the deal").toBeGreaterThanOrEqual(3);
  expect(frames.filter((shown) => shown).length, "of them, frames showing the question underneath").toBe(0);
  await expect(question(page)).not.toHaveText(last ?? "");
});
