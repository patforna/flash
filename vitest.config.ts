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
  },
});
