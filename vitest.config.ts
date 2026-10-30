import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Only the DOM side runs here; server/, scripts/ and shared/ run under `bun test`, tests/e2e under Playwright.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}", "tests/conventions.test.ts"],
    // Testing Library cleans up after each test only when `afterEach` is a global. Import test APIs from "vitest" anyway.
    globals: true,
    passWithNoTests: true,
    // CSS is blanked in tests, ?raw too; the contrast test reads the tokens as written.
    css: { include: [/tokens\.css/] },
    // The persistent module cache keeps a test's import.meta.glob expansion until the test file itself changes, so
    // tests/conventions.test.ts would never see a new source file. It saves nothing measurable at this size.
    fsModuleCache: false,
  },
});
