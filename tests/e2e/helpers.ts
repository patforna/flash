import { test as base, type CDPSession, expect, type Locator, type Page } from "@playwright/test";
import type { Deck } from "../../shared/types";

// Shared by the specs (docs/plan.md §12): deterministic input through CDP, waiting for the app to settle, and the
// emulation Playwright has no option for. Every page gets the seeded Math.random, so a pass is dealt the same way on
// every run.

export { expect };

export const test = base.extend({
  page: async ({ page }, use) => {
    await seed(page);
    await use(page);
  },
});

export interface Point {
  x: number;
  y: number;
}

// One CDP session per page.
const sessions = new WeakMap<Page, Promise<CDPSession>>();
export function cdp(page: Page): Promise<CDPSession> {
  let session = sessions.get(page);
  if (!session) {
    session = page.context().newCDPSession(page);
    sessions.set(page, session);
  }
  return session;
}

// Math.random as mulberry32 from a fixed seed, before any of the page's scripts run.
export async function seed(page: Page, from = 42): Promise<void> {
  await page.addInitScript((s) => {
    let a = s;
    Math.random = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, from);
}

const MOVE_MS = 8; // a touch screen's report rate: a move every 8 ms

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

// A finger on the screen: CDP touch events (real pointerType "touch") with explicit timestamps, paced in real time,
// so the page sees exactly the speed asked for. Every gesture of the specs is made of these.
export async function finger(page: Page, at: Point) {
  const session = await cdp(page);
  const t0 = Date.now();
  let elapsed = 0; // ms since touchStart, on the events' clock
  let here = at;
  const send = async (type: "touchStart" | "touchMove" | "touchEnd", point?: Point) => {
    await sleep(t0 + elapsed - Date.now());
    await session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: point ? [{ x: point.x, y: point.y, id: 1 }] : [],
      timestamp: (t0 + elapsed) / 1000,
    });
  };
  await send("touchStart", at);
  return {
    // Straight to `to` in `ms`, a move every 8 ms.
    async move(to: Point, ms: number) {
      const from = here;
      const steps = Math.max(1, Math.round(ms / MOVE_MS));
      for (let i = 1; i <= steps; i++) {
        elapsed += ms / steps;
        here = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
        await send("touchMove", here);
      }
    },
    async wait(ms: number) {
      elapsed += ms;
      await sleep(t0 + elapsed - Date.now());
    },
    async up() {
      await send("touchEnd");
    },
  };
}

// A straight swipe from `from` to `to` in `ms`, then lifted.
export async function swipe(page: Page, { from, to, ms }: { from: Point; to: Point; ms: number }): Promise<void> {
  const f = await finger(page, from);
  await f.move(to, ms);
  await f.up();
}

// A tap: down and up in 40 ms without moving.
export async function tap(page: Page, at: Point): Promise<void> {
  const f = await finger(page, at);
  await f.wait(40);
  await f.up();
}

// Nothing moving: no animation or transition running, no flip under way, every stage idle.
export async function settled(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document.getAnimations().length === 0 &&
      document.querySelector("[data-flipping]") === null &&
      Array.from(document.querySelectorAll<HTMLElement>("[data-state]")).every((el) => el.dataset.state === "idle"),
  );
}

// The first card is on screen, written in its fonts (the app's performance mark).
export async function firstCard(page: Page): Promise<void> {
  await page.waitForFunction(() => performance.getEntriesByName("flash:first-card").length > 0);
}

// Every Playwright page is a browser tab that offers fullscreen, so the fullscreen chip shows; a key press (the
// shortcut f) does switch headless Chromium to display-mode fullscreen, as the installed app is.
export async function fullscreen(page: Page): Promise<void> {
  await page.keyboard.press("f");
  await page.waitForFunction(() => matchMedia("(display-mode: fullscreen)").matches);
}

// The phone's safe areas, as env(safe-area-inset-*) reads them (a camera cutout, say).
export async function insets(page: Page, { left = 0, right = 0 }: { left?: number; right?: number }): Promise<void> {
  const session = await cdp(page);
  await session.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, left, bottom: 0, right } });
}

// The card being read, and the cards on either side of it (the stage's layers, plan §11).
export const layer = (page: Page, role: "prev" | "current" | "next" = "current"): Locator =>
  page.locator(`[data-role="${role}"]`);

// A layer's question, as its front shows it.
export const question = (page: Page, role: "prev" | "current" | "next" = "current"): Locator =>
  layer(page, role).locator("h2").first();

// The side the card on top shows ("front" or "back"), from its flipper.
export const flipper = (page: Page): Locator => layer(page).locator("[data-side]");

// The app's one live region: "Card 7 of 16", or what the end card says.
export const announcer = (page: Page): Locator => page.locator("[aria-live]");

// Every question of the deck as the reader sees it: the server's HTML through the browser's own parser.
export async function questions(page: Page): Promise<string[]> {
  const deck: Deck = await (await page.request.get("/api/cards")).json();
  return page.evaluate(
    (html) =>
      html.map((h) => {
        const template = document.createElement("template");
        template.innerHTML = h;
        return template.content.textContent ?? "";
      }),
    deck.cards.map((card) => card.questionHtml),
  );
}

// The card's centre, where a tap or a swipe starts.
export async function centre(page: Page): Promise<Point> {
  const box = await layer(page).boundingBox();
  if (!box) throw new Error("no card on the stage");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Across most of the card, quickly, as a thumb flicks it: left for the next card, right for the previous one.
export async function flick(page: Page, dir: "left" | "right", { by = 300, ms = 120 } = {}): Promise<void> {
  const from = await centre(page);
  await swipe(page, { from, to: { x: from.x + (dir === "left" ? -by : by), y: from.y }, ms });
}

// The card's topics, as its front lists them.
export const topicsOf = (page: Page): Promise<string[]> =>
  layer(page).locator("[data-side] > :first-child li").allTextContents();
