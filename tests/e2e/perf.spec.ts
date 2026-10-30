import type { Page } from "@playwright/test";
import { animated, cdp, centre, expect, finger, firstCard, flick, settled, swipe, tap, test } from "./helpers";

// The budgets of docs/plan.md §12, on the Pixel 11 with the CPU slowed 4× through CDP: the first card on a cold
// start, the latency of a tap and a key (Event Timing, never a trace: traces inflate DOM-heavy timings), no long
// animation frame while reading, and only compositor-friendly properties animated. The config runs this file alone,
// as its own project after all the others: on a CPU the other specs share, timings are noise.
//
// While a measured frame is on its way the page is left alone: waiting with settled() would poll
// document.getAnimations(), and its style recalculations would land in the very frames being measured.

const quiet = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function slowCPU(page: Page) {
  await (await cdp(page)).send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

// What the observers have seen since `since` (a performance.now() time): Event Timing entries of 16 ms or more, and
// long animation frames (over 50 ms, by definition).
interface Seen {
  events: { name: string; duration: number }[];
  frames: number[];
}

async function observe(page: Page) {
  await page.evaluate(() => {
    const seen: { events: PerformanceEventTiming[]; frames: PerformanceEntry[] } = { events: [], frames: [] };
    Object.assign(window, { seen });
    // durationThreshold is missing from TypeScript's PerformanceObserverInit.
    const events = { type: "event", durationThreshold: 16, buffered: true };
    new PerformanceObserver((list) => {
      seen.events.push(...(list.getEntries() as PerformanceEventTiming[]));
    }).observe(events);
    new PerformanceObserver((list) => {
      seen.frames.push(...list.getEntries());
    }).observe({ type: "long-animation-frame", buffered: true });
  });
}

async function seenSince(page: Page, since: number): Promise<Seen> {
  // Entries arrive after the frame they describe is presented: give the observers two frames.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.evaluate((t) => {
    const { seen } = window as unknown as {
      seen: { events: PerformanceEventTiming[]; frames: PerformanceEntry[] };
    };
    return {
      events: seen.events.filter((e) => e.startTime >= t).map((e) => ({ name: e.name, duration: e.duration })),
      frames: seen.frames.filter((f) => f.startTime >= t).map((f) => Math.round(f.duration)),
    };
  }, since);
}

const now = (page: Page) => page.evaluate(() => performance.now());

test("cold, the first card shows within 1,200 ms", async ({ page }) => {
  // No service worker (the config blocks it), no HTTP cache, 40 ms round trips at 10 Mbit/s down.
  const session = await cdp(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 40,
    downloadThroughput: 10_000_000 / 8,
    uploadThroughput: -1,
  });
  await slowCPU(page);

  await page.goto("/");
  await firstCard(page);

  const ms = await page.evaluate(() => performance.getEntriesByName("flash:first-card")[0]?.startTime ?? Infinity);
  test.info().annotations.push({ type: "first card, cold", description: `${Math.round(ms)} ms` });
  expect(ms).toBeLessThanOrEqual(1200);
});

test("a tap turns the card and a key deals the next, each within 48 ms (Event Timing)", async ({ page }) => {
  await page.goto("/");
  await firstCard(page);
  await settled(page);
  await observe(page);
  await slowCPU(page);
  const since = await now(page);

  await tap(page, await centre(page));
  await quiet(700);
  await page.keyboard.press("l");
  await quiet(700);

  const { events } = await seenSince(page, since);
  const worst = events.reduce((max, e) => Math.max(max, e.duration), 0);
  test.info().annotations.push({
    type: "worst Event Timing entry",
    description: `${worst} ms (${events.length} entries of 16 ms or more)`,
  });
  expect(events.filter((e) => e.duration > 48)).toEqual([]);
});

test("no animation frame takes over 50 ms while a card turns and is swiped away", async ({ page }) => {
  await page.goto("/");
  await firstCard(page);
  await settled(page);
  await observe(page);
  await slowCPU(page);
  const since = await now(page);

  await tap(page, await centre(page));
  await quiet(700);
  await flick(page, "left");
  await quiet(800);
  await flick(page, "right");
  await quiet(800);

  const { frames } = await seenSince(page, since);
  test.info().annotations.push({ type: "long animation frames", description: `${frames.length}: ${frames}` });
  expect(frames).toEqual([]);
});

test("whatever runs animates only transform and opacity", async ({ page }) => {
  await page.goto("/");
  await firstCard(page);
  await settled(page);
  await slowCPU(page);
  const compositorOnly = (properties: string[]) => properties.every((p) => p === "transform" || p === "opacity");

  // Mid-flip.
  await tap(page, await centre(page));
  const flip = await animated(page);
  await settled(page);
  // Mid-fling.
  const at = await centre(page);
  await swipe(page, { from: at, to: { x: at.x - 300, y: at.y }, ms: 120 });
  const fling = await animated(page);
  await settled(page);
  // Mid-cancel: a short, slow drag let go.
  const f = await finger(page, at);
  await f.move({ x: at.x - 60, y: at.y }, 240);
  await f.up();
  const cancel = await animated(page);
  await settled(page);
  // Mid-deal (s reshuffles), and a chip pressed.
  await page.keyboard.press("s");
  const deal = await animated(page);
  await settled(page);
  await page.getByRole("button", { name: "Redis, 2 cards", exact: true }).tap();
  const chip = await animated(page);

  for (const [moment, properties] of Object.entries({ flip, fling, cancel, deal, chip })) {
    expect(properties.length, `${moment}: something runs`).toBeGreaterThan(0);
    expect(compositorOnly(properties), `${moment}: ${properties}`).toBe(true);
  }
});
