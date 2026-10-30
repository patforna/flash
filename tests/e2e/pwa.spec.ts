import { expect, type Page, test } from "@playwright/test";
import type { Deck } from "../../shared/types";
import { cdp, firstCard } from "./helpers";

// The installable app and its service worker (plan §6 and §12).

test.use({ serviceWorkers: "allow" });

// Nothing here depends on the screen, so it runs once, on the phone.
test.beforeEach(() => {
  test.skip(test.info().project.name !== "pixel11", "the PWA checks run on the Pixel 11 only");
});

const desk = "#11131A";

// Every question of the deck as the reader sees it: the server's HTML through the browser's own parser.
async function deckQuestions(page: Page): Promise<RegExp> {
  const deck: Deck = await (await page.request.get("/api/cards")).json();
  const questions = await page.evaluate(
    (html) =>
      html.map((question) => {
        const template = document.createElement("template");
        template.innerHTML = question;
        return (template.content.textContent ?? "").replace(/\s+/g, " ").trim();
      }),
    deck.cards.map((card) => card.questionHtml),
  );
  return new RegExp(questions.map((question) => RegExp.escape(question)).join("|"));
}

// A question of the deck, showing on the card being read (the DOM contract, plan §11).
function questionShown(page: Page, questions: RegExp) {
  return page.locator('[data-role="current"]').getByText(questions).filter({ visible: true }).first();
}

async function workerInControl(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

test("the page links a manifest with every field of plan §6, its icons PNGs of the sizes it names", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");

  const response = await page.request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest: { icons: { src: string; sizes: string }[] } = await response.json();
  expect(manifest).toMatchObject({
    id: "/",
    name: "flash",
    short_name: "flash",
    lang: "en-GB",
    start_url: "/",
    scope: "/",
    display: "fullscreen",
    orientation: "landscape",
    background_color: desk,
    theme_color: desk,
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  });

  for (const { src, sizes } of manifest.icons) {
    const icon = await page.request.get(new URL(src, response.url()).href);
    expect(icon.headers()["content-type"]).toBe("image/png");
    const png = await icon.body();
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(sizes); // IHDR width and height
  }
});

test("once loaded, the service worker controls the page, its precache holding index.html, the JS, the CSS and both fonts", async ({
  page,
}) => {
  await page.goto("/");
  await workerInControl(page);

  const precached = await page.evaluate(async () => {
    const paths: string[] = [];
    for (const name of await caches.keys()) {
      if (!name.startsWith("workbox-precache")) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) paths.push(new URL(request.url).pathname);
    }
    return paths;
  });
  const script = await page.locator('script[type="module"]').getAttribute("src");
  const stylesheet = await page.locator('link[rel="stylesheet"]').getAttribute("href");
  expect(precached).toEqual(
    expect.arrayContaining([
      "/index.html",
      script,
      stylesheet,
      expect.stringMatching(/^\/assets\/shantell-sans-latin-full-normal-[\w-]+\.woff2$/),
      expect.stringMatching(/^\/assets\/monaspace-radon-latin-400-normal-[\w-]+\.woff2$/),
    ]),
  );
});

test("reads offline once the deck has been fetched under the service worker", async ({ page, context }) => {
  const questions = await deckQuestions(page);
  await page.goto("/");
  await workerInControl(page);
  // The first load's preload ran before the worker took control, so the deck reaches the worker's cache only now.
  await page.reload();
  await expect(questionShown(page, questions)).toBeVisible();
  // The worker answers before it has finished writing the deck to its cache.
  await expect
    .poll(() => page.evaluate(async () => (await caches.match("/api/cards", { ignoreVary: true })) !== undefined))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();

  await expect(questionShown(page, questions)).toBeVisible();
});

test("the first load requests the deck once: the app takes the preloaded response", async ({ page }) => {
  const questions = await deckQuestions(page);
  const deckRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/cards") deckRequests.push(request.url());
  });

  await page.goto("/");
  await expect(questionShown(page, questions)).toBeVisible();
  await workerInControl(page);

  expect(deckRequests).toHaveLength(1);
});

test("installed and offline, the first card shows within 350 ms with the CPU slowed 4×", async ({ page, context }) => {
  await page.goto("/");
  await workerInControl(page);
  // The first load's preload ran before the worker took control, so the deck reaches the worker's cache only now.
  await page.reload();
  await firstCard(page);
  await expect
    .poll(() => page.evaluate(async () => (await caches.match("/api/cards", { ignoreVary: true })) !== undefined))
    .toBe(true);
  await context.setOffline(true);
  await (await cdp(page)).send("Emulation.setCPUThrottlingRate", { rate: 4 });

  await page.reload();
  await firstCard(page);

  const ms = await page.evaluate(() => performance.getEntriesByName("flash:first-card")[0]?.startTime ?? Infinity);
  test.info().annotations.push({ type: "first card, warm and offline", description: `${Math.round(ms)} ms` });
  expect(ms).toBeLessThanOrEqual(350);
});
