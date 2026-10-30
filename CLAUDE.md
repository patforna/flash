# flash

A flash card PWA for studying on a Pixel 11 in fullscreen landscape: a hand-written index card on a dark desk, topic stickers beside it; tap to flip, swipe for the next card. Reading only; the deck is `cards/cards.toml`, edited outside the app.

The spec is `docs/plan.md` (Part 2; frozen), the brief `docs/original-request.md` (it wins over the plan). This is v1 for the parallel build; P7 writes the final one.

## Ownership (plan §16)

Each file has exactly one owner. Never edit a file you don't own: say what you need in your report.

- **M0 Scaffold, then M2 Integration**: `package.json`, `bun.lock`, `bunfig.toml`, `tsconfig.json`, `tsconfig.node.json`, `biome.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `index.html`, `.gitignore`, `shared/types.ts`, `src/deck/types.ts`, `src/main.tsx`, `src/styles/tokens.css`, `src/styles/fonts.css`, `src/fonts/*`, `tests/fixtures/cards.toml`.
- **P1 Server and data**: `shared/schema.ts`, `shared/glyphs.ts`, `server/*`, `scripts/check-cards.ts`, `src/api/*`.
- **P2 Deck engine**: `src/deck/*` except `types.ts`.
- **P3 Stage and gestures**: `src/gesture/*`, `src/motion/*`, `src/stage/*`, `src/app/useShortcuts.ts`.
- **P4 Look and feel**: `src/styles/global.css`, `src/card/*`, `src/panel/*`, `src/desk/*`, `public/icon.svg` and the PNG icons generated from it (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, as the manifest names them).
- **P5 Platform and PWA**: `src/platform/*`, `tests/e2e/pwa.spec.ts`.
- **P6 Seed cards**: `cards/cards.toml`, `docs/seed.md`.
- **P7 Ops and docs**: `scripts/deploy-do.sh`, `scripts/budget.ts`, `README.md`, `docs/cards.md`, the final `CLAUDE.md`.
- **M2 Integration**: `src/app/App.tsx` and its test, every e2e spec but `pwa.spec.ts`, `tests/e2e/helpers.ts`, `tests/screenshots/`, `tests/conventions.test.ts`; then everything M0 owned.

## Rules

- Strict Beck-style TDD: a failing test first, the simplest change to green, refactor at green; commit at every green on your own branch `pkg/<id>`. Type declarations, configuration and pure wiring need no test.
- Never add dependencies or touch `package.json`, `bun.lock` or any config; ask in your report.
- The interfaces in plan §11 are frozen; build behind them, including the DOM contract between the stage and the card (§11). During M1 import only M0's files and your own package's; cross-package wiring is M2's `App`.
- Braced effect bodies only: `useEffect(() => { … })`, never `useEffect(() => expr)` (a returned Promise is called as cleanup and blanks the app).
- Animate only `transform` and `opacity`. No React state during drags: write transforms to the element in `pointermove`.
- Measure text only after `document.fonts.load()`, never on `document.fonts.status`.
- British English everywhere: copy, comments, identifiers (`colourFor`).
- No dead code: remove what a change makes unused in the same change.

## Commands

- `bun run test`: Vitest, then `bun test ./server ./scripts ./shared`. Until server, script or shared tests exist the second half fails with "filters did not match any test files"; run `bunx vitest run` or `bun test ./server` for your own package meanwhile.
- `bun run typecheck`: `tsc` 7 on `tsconfig.json`, then `tsconfig.node.json`.
- `bun run lint`: Biome with `--error-on-warnings`; `bunx biome check --write .` fixes formatting and import order.
- `bun run build`: Vite into `dist/`, the server into `build/server.js`.
- `bun run e2e`: Playwright, headless, against `build/server.js`, so build first.
- `bun run verify`: every gate in order.

## Facts the packages build on

- Tests sit beside their module as `x.test.ts(x)`. Vitest (happy-dom) runs only `src/**/*.test.{ts,tsx}` and `tests/conventions.test.ts`; `bun test` runs `server/`, `scripts/` and `shared/`; Playwright runs `tests/e2e/`.
- Import Vitest's APIs explicitly; its globals are on only so Testing Library cleans up after each test.
- TypeScript 7 (native `tsc`) with `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (types via `import type`), bundler resolution, extensionless imports. `tsconfig.json` is the browser program (DOM and `vite/client`, no Bun or Node types): `src`, `shared`, `tests/conventions.test.ts`, and `server/api.ts` through the client's type import, so `server/api.ts` must import nothing Bun-specific. `tsconfig.node.json` is the Bun program (`bun` types, plus the DOM lib for `page.evaluate` callbacks): `server`, `scripts`, `shared`, `tests/e2e`, the config files.
- Hono: `import { serveStatic } from "@hono/bun"` on the server (`hono/bun`'s is deprecated; neither sends an ETag for static files); `import { hc } from "hono/client"` with `hc<Api>` in the client (types checked across both programs).
- Fonts: `font-family: "Shantell Sans"` (variable, `font-weight` 300–800, axes through `font-variation-settings: "INFM" 0–100, "BNCE" −100–100, "SPAC" 0–100`) and `"Monaspace Radon"` (400 only). `src/styles/fonts.css` declares both; `index.html` preloads Shantell from `/src/fonts/`, which Vite rewrites to the same hashed `/assets/` URL the CSS uses. Shantell's file has no → or ← glyph, so set handwriting with `var(--font-hand)` (Shantell, then Radon, which has both) and code with `var(--font-code)`; never name a family directly.
- `src/main.tsx` imports `styles/tokens.css` and `styles/fonts.css`; tokens are custom properties on `:root`, including `--flip-duration`, `--flip-easing` and `--flip-fade-duration`.
- Playwright projects `pixel11` (923 × 412, DPR 2.625, touch), `portrait` (412 × 923) and `laptop` (1280 × 800, fine pointer); en-GB, Europe/Zurich. Port 4173 serves `tests/fixtures/cards.toml` and is the base URL; 4174 serves `cards/cards.toml` (`test.use({ baseURL: "http://127.0.0.1:4174" })`). Service workers are blocked unless a spec sets `test.use({ serviceWorkers: "allow" })`. Screenshots go to `tests/screenshots/<project>/<name>.png`, so names are unique across specs; `animations: "disabled"`, `caret: "hide"` and `maxDiffPixelRatio: 0.001` are the config defaults. Never run a headed browser.
- The fixture deck: 9 cards, 7 topics (Redis, Postgres, Queues, Consistency, Sharding, Real-time, Case studies; Consistency has one card, Postgres and Queues three). It covers every markup feature; one card has three topics, one question is exactly 100 characters and the shard-key answer (498 characters, 12 lines) needs fit step 2. Its 64-character ids rely on `slug()` truncating.
