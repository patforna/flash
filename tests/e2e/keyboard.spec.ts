import type { Page } from "@playwright/test";
import { announcer, expect, firstCard, flipper, question, settled, test } from "./helpers";

// The keys (docs/plan.md §4): Space, Enter, ↑, ↓, j and k flip; →, l and PageDown next; ←, h and PageUp previous;
// s reshuffles; f toggles fullscreen. Nothing fires with Alt, Ctrl or Meta, and a focused button keeps Space and
// Enter for itself. On the laptop, where there is a keyboard. The fixture deck holds 9 cards.

test.beforeEach(async ({ page }) => {
  test.skip(test.info().project.name !== "laptop", "keys, on the laptop");
  await page.goto("/");
  await firstCard(page);
  await settled(page);
});

async function press(page: Page, key: string) {
  await page.keyboard.press(key);
  await settled(page);
}

const isFullscreen = (page: Page) => page.evaluate(() => matchMedia("(display-mode: fullscreen)").matches);

test("Space, Enter, ↑, ↓, j and k turn the card over and back", async ({ page }) => {
  const first = await question(page).textContent();
  let side = "front";
  for (const key of ["Space", "Enter", "ArrowUp", "ArrowDown", "j", "k"]) {
    side = side === "front" ? "back" : "front";
    await press(page, key);
    await expect(flipper(page), key).toHaveAttribute("data-side", side);
  }
  await expect(question(page)).toHaveText(first ?? "");
  await expect(announcer(page)).toHaveText("Card 1 of 9");
});

test("→, l and PageDown deal the next card", async ({ page }) => {
  for (const [i, key] of ["ArrowRight", "l", "PageDown"].entries()) {
    const next = await question(page, "next").textContent();
    await press(page, key);
    await expect(announcer(page), key).toHaveText(`Card ${i + 2} of 9`);
    await expect(question(page), key).toHaveText(next ?? "");
  }
});

test("←, h and PageUp bring back the previous card", async ({ page }) => {
  for (let i = 0; i < 3; i++) await press(page, "l");
  await expect(announcer(page)).toHaveText("Card 4 of 9");

  for (const [i, key] of ["ArrowLeft", "h", "PageUp"].entries()) {
    const prev = await question(page, "prev").textContent();
    await press(page, key);
    await expect(announcer(page), key).toHaveText(`Card ${3 - i} of 9`);
    await expect(question(page), key).toHaveText(prev ?? "");
  }
});

test("s deals a new pass that doesn't start with the card on screen", async ({ page }) => {
  await press(page, "l");
  await press(page, "l");
  await expect(announcer(page)).toHaveText("Card 3 of 9");
  const third = await question(page).textContent();

  await press(page, "s");

  await expect(announcer(page)).toHaveText("Card 1 of 9");
  await expect(question(page)).not.toHaveText(third ?? "");
});

test("f goes fullscreen, where the exit chip takes the fullscreen chip's place, and f again comes back", async ({
  page,
}) => {
  const chip = page.getByRole("button", { name: "Full screen", exact: true });
  const exit = page.getByRole("button", { name: "Exit full screen", exact: true });
  await expect(chip).toBeVisible();
  await expect(exit).toHaveCount(0);

  await page.keyboard.press("f");
  await expect.poll(() => isFullscreen(page)).toBe(true);
  await expect(chip).toHaveCount(0);
  await expect(exit).toBeVisible();

  await page.keyboard.press("f");
  await expect.poll(() => isFullscreen(page)).toBe(false);
  await expect(chip).toBeVisible();
  await expect(exit).toHaveCount(0);
});

test("nothing fires with Alt, Ctrl or Meta held", async ({ page }) => {
  const first = await question(page).textContent();
  for (const modifier of ["Alt", "Control", "Meta"]) {
    for (const key of ["Space", "j", "l", "ArrowRight", "s", "f"]) await page.keyboard.press(`${modifier}+${key}`);
  }
  // Every action starts on keydown (a flip renders, a move animates, fullscreen switches): two frames are plenty.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // Nothing on the clock: the topic panel's fade moves only with its scroll.
  expect(await page.evaluate(() => document.getAnimations().some((a) => a.timeline === document.timeline))).toBe(false);
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
  await expect(question(page)).toHaveText(first ?? "");
  await expect(announcer(page)).toHaveText("Card 1 of 9");
  expect(await isFullscreen(page)).toBe(false);
  // The same keys alone do fire.
  await press(page, "l");
  await expect(announcer(page)).toHaveText("Card 2 of 9");
});

test("a focused button takes Space and Enter for itself: they press it, and nothing else", async ({ page }) => {
  // Were the shortcut to fire as well, the card would turn twice and show its front.
  const turn = page.getByRole("button", { name: "Show answer" });
  await turn.focus();
  await press(page, "Space");
  await expect(flipper(page)).toHaveAttribute("data-side", "back");
  await expect(page.getByRole("button", { name: "Show question" })).toBeFocused();
  await press(page, "Enter");
  await expect(flipper(page)).toHaveAttribute("data-side", "front");

  await page.getByRole("button", { name: "Next" }).focus();
  await press(page, "Space");
  await expect(announcer(page)).toHaveText("Card 2 of 9");
  await expect(flipper(page)).toHaveAttribute("data-side", "front");

  const redis = page.getByRole("button", { name: "Redis, 2 cards", exact: true });
  await redis.focus();
  await press(page, "Enter");
  await expect(redis).toHaveAttribute("aria-pressed", "true");
  await expect(announcer(page)).toHaveText("Card 1 of 2");
  await expect(flipper(page)).toHaveAttribute("data-side", "front");
});
