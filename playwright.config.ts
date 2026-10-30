import { defineConfig, devices } from "@playwright/test";

// Pixel 11 traits. Chrome on Android sends the reduced user agent: Android version and model frozen to "10" and "K".
const pixel11 = {
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36",
};

// The built server (`bun run build` first) on its own port and deck.
function server(port: number, cards: string) {
  return {
    command: "bun build/server.js",
    env: { PORT: String(port), CARDS: cards, DIST: "dist", HOST: "127.0.0.1" },
    url: `http://127.0.0.1:${port}/healthz`,
    reuseExistingServer: !process.env.CI,
  };
}

export default defineConfig({
  testDir: "tests/e2e",
  snapshotPathTemplate: "tests/screenshots/{projectName}/{arg}{ext}",
  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.001 },
  },
  use: {
    // Port 4173 serves the fixture deck; the fit spec switches to 4174 (the real deck) with test.use({ baseURL }).
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    locale: "en-GB",
    timezoneId: "Europe/Zurich",
    // The PWA spec opts in with test.use({ serviceWorkers: "allow" }).
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "pixel11",
      use: { ...pixel11, viewport: { width: 923, height: 412 }, screen: { width: 923, height: 412 } },
      testIgnore: "perf.spec.ts",
    },
    {
      name: "portrait",
      use: { ...pixel11, viewport: { width: 412, height: 923 }, screen: { width: 412, height: 923 } },
      testIgnore: "perf.spec.ts",
    },
    {
      name: "laptop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      testIgnore: "perf.spec.ts",
    },
    // The Pixel 11 again, for the performance budgets alone, after every other project: timings taken while the other
    // specs share the CPU are noise.
    {
      name: "perf",
      use: { ...pixel11, viewport: { width: 923, height: 412 }, screen: { width: 923, height: 412 } },
      testMatch: "perf.spec.ts",
      dependencies: ["pixel11", "portrait", "laptop"],
    },
  ],
  webServer: [server(4173, "tests/fixtures/cards.toml"), server(4174, "cards/cards.toml")],
});
