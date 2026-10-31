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
  leaving,
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

test("a flicked card leaves as it was let go: it moves on every frame until it is off the screen", async ({ page }) => {
  const steps = leaving(page);
  await flick(page, "left");

  const travelled = await steps;
  expect(travelled.length, "frames until it is off the screen").toBeGreaterThanOrEqual(3);
  expect(
    travelled.filter((px) => px <= 0),
    "frames standing still",
  ).toEqual([]);
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

// Frame by frame from the second touch on, for 30 frames: how far the card with this question moved since the frame
// before (its layer's x, in px), whichever layer it is in.
const steps = (page: Page, writing: string) =>
  page.evaluate(
    (writing) =>
      new Promise<number[]>((resolve) => {
        let touches = 0;
        addEventListener("pointerdown", () => touches++, { capture: true });
        const moved: number[] = [];
        let last: number | null = null;
        const look = () => {
          const card = [...document.querySelectorAll("[data-role]")].find(
            (layer) => layer.querySelector("h2")?.textContent === writing,
          );
          const x = card ? new DOMMatrix(getComputedStyle(card).transform).m41 : null;
          if (touches >= 2 && last !== null && x !== null) moved.push(Math.abs(x - last));
          last = x;
          if (moved.length === 30) return resolve(moved);
          requestAnimationFrame(look);
        };
        requestAnimationFrame(look);
      }),
    writing,
  );

test("a card coming back when the next touch lands its move carries on into its place: it never jumps", async ({
  page,
}) => {
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press("l");
    await settled(page);
  }
  const back = (await question(page, "prev").textContent()) ?? "";
  const travelled = steps(page, back);

  await flick(page, "right");
  await new Promise((resolve) => setTimeout(resolve, 80));
  await flick(page, "right");

  expect(Math.max(...(await travelled)), "the largest step from one frame to the next, in px").toBeLessThanOrEqual(100);
  await expect(announcer(page)).toHaveText("Card 1 of 9");
});

// Where the card on top is (its layer's x, in px) in the last frame before the next touch, and in the three after it.
const aroundTouch = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ before: number; after: number[] }>((resolve) => {
        const card = document.querySelector('[data-role="current"]');
        if (!card) throw new Error("no card on the stage");
        let touched = false;
        addEventListener("pointerdown", () => (touched = true), { capture: true, once: true });
        let before = Number.NaN;
        const after: number[] = [];
        const look = () => {
          const x = new DOMMatrix(getComputedStyle(card).transform).m41;
          if (touched) after.push(x);
          else before = x;
          if (after.length === 3) return resolve({ before, after });
          requestAnimationFrame(look);
        };
        requestAnimationFrame(look);
      }),
  );

test("a card springing back is caught where it is by the next touch", async ({ page }) => {
  const at = await centre(page);
  const f = await finger(page, at);
  // Slowly, and short of the commit distance: it springs back.
  await f.move({ x: at.x - 120, y: at.y }, 600);
  await f.up();
  const caught = aroundTouch(page);
  await new Promise((resolve) => setTimeout(resolve, 40));
  const again = await finger(page, at);

  const { before, after } = await caught;
  expect(before, "still on its way back").toBeLessThan(-15);
  expect(
    after.map((x) => Math.abs(x - before)).every((d) => d <= 5),
    `${before} → ${after}`,
  ).toBe(true);
  await again.up();
  await settled(page);
  expect(await dragged(page)).toBe("");
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

// Where the copy of a card still flying out is, frame by frame (its right edge, in px), and what it shows: a card
// wanted at once flies on as a copy beside the stage's layers. [] when there is none.
const flyingOn = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ text: string; right: number }[]>((resolve) => {
        const seen: { text: string; right: number }[] = [];
        const look = () => {
          const copy = document.querySelector('[data-role="current"] ~ div:not([data-role])');
          if (copy) seen.push({ text: copy.textContent ?? "", right: copy.getBoundingClientRect().right });
          if (!copy || seen.length === 3) return resolve(seen);
          requestAnimationFrame(look);
        };
        requestAnimationFrame(look);
      }),
  );

test("a card still flying out when the next touch lands flies on: it never vanishes mid-air", async ({ page }) => {
  const first = (await question(page).textContent()) ?? "";
  const at = await centre(page);
  await swipe(page, { from: at, to: { x: at.x - 160, y: at.y }, ms: 48 });

  const f = await finger(page, at);
  const flight = await flyingOn(page);

  expect(flight.length, "frames of the flight after the touch").toBe(3);
  expect(flight.every(({ text }) => text.includes(first))).toBe(true);
  const rights = flight.map(({ right }) => right);
  expect(rights[0], "on screen as the touch lands").toBeGreaterThan(0);
  expect(rights, "moving left").toEqual([...rights].sort((a, b) => b - a));
  expect(new Set(rights).size, "moving").toBe(3);
  await expect(announcer(page)).toHaveText("Card 2 of 9");
  await f.move({ x: at.x - 40, y: at.y }, 80);
  await f.up();
});

test("a reshuffle while a card flies out deals the new pass under it: it flies on", async ({ page }) => {
  const first = (await question(page).textContent()) ?? "";
  const at = await centre(page);
  await swipe(page, { from: at, to: { x: at.x - 160, y: at.y }, ms: 48 });
  await page.keyboard.press("s");
  const flight = await flyingOn(page);

  expect(flight.length, "frames of the flight after the reshuffle").toBe(3);
  expect(flight.every(({ text }) => text.includes(first))).toBe(true);
  const rights = flight.map(({ right }) => right);
  expect(rights[0], "on screen as the reshuffle lands").toBeGreaterThan(0);
  expect(new Set(rights).size, "moving").toBe(3);
  await expect(announcer(page)).toHaveText("Card 1 of 9");
});

test("the end card's tick draws itself as the last card leaves it, not once the move lands", async ({ page }) => {
  for (let i = 1; i < 9; i++) {
    await page.keyboard.press("l");
    await settled(page);
  }
  await page.keyboard.press("l");
  // Which layers hold a stroke drawing itself.
  const drawing = () =>
    page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a instanceof CSSAnimation && a.animationName.includes("tick"))
        .map((a) => (a.effect as KeyframeEffect | null)?.target?.closest("[data-role]")?.getAttribute("data-role")),
    );

  expect(await drawing(), "as the move is decided").toEqual(["next", "next"]);
  await expect(announcer(page)).toHaveText(/^That’s all/);
  expect(await drawing(), "once it has landed").toEqual([]);
});

test("a swipe on the end card deals the next pass at once, under the end card flying off", async ({ page }) => {
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("l");
    await settled(page);
  }
  await expect(announcer(page)).toHaveText("That’s all 9. Tap or swipe to shuffle again.");

  await flick(page, "left");
  const flight = await flyingOn(page);

  await expect(announcer(page)).toHaveText("Card 1 of 9");
  expect(flight.length, "frames of the end card flying off").toBeGreaterThan(0);
  expect(flight[0]?.text).toContain("That’s all 9.");
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
  await expect(announcer(page)).toHaveText("That’s all 9. Tap or swipe to shuffle again.");
  await expect(layer(page).getByText("That’s all 9.")).toBeVisible();
  await settled(page);
  // A swipe right from the end card goes back to the last card, and a swipe left returns to the end card.
  await flick(page, "right");
  await expect(question(page)).toHaveText(last ?? "");
  await settled(page);
  await flick(page, "left");
  await expect(announcer(page)).toHaveText("That’s all 9. Tap or swipe to shuffle again.");
  await settled(page);

  await tap(page, await centre(page));

  await expect(announcer(page)).toHaveText("Card 1 of 9");
  // The new card fades in over the one underneath, which is blank paper until it has landed.
  const frames = await underneathWhile(page, '[data-role="current"]');
  expect(frames.length, "frames of the deal").toBeGreaterThanOrEqual(3);
  expect(frames.filter((shown) => shown).length, "of them, frames showing the question underneath").toBe(0);
  await expect(question(page)).not.toHaveText(last ?? "");
});
