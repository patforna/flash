# flash

A flash card PWA for studying on a Pixel 11 in fullscreen landscape: a hand-written index card on a dark desk, topic stickers beside it; tap to flip, swipe for the next card. Reading only; the deck is `cards/cards.toml`, edited outside the app. Live at https://flash.patforna.com.

Patric's brief is `docs/original-request.md`: it wins over everything. The spec is `docs/plan.md` (Part 2; frozen, Part 1 records why). `README.md` is for Patric; `docs/cards.md` is the card format and rules; `docs/seed.md` is how the seed deck was made and corrected.

## Purpose and constraints

- The first requirement: extremely smooth, snappy and polished; high quality, funky and hip.
- Reading only: no editing in the app, no write API, no auth, no accounts.
- Landscape first, on a Pixel 11 (923 × 412 CSS px in fullscreen); portrait works in a tab but isn't polished.
- KISS and YAGNI: easier to add than to remove. Plan §18 lists what is out of scope.
- British English everywhere: copy, comments, identifiers (`colourFor`).
- No dead code: remove what a change makes unused in the same change.

## Decisions

Each with its reason, from the plan; everything else is specified in its Part 2.

Reading:

- Topics in a permanent panel on the left: it uses width the 5:3 card can't, and nothing takes height.
- Multi-select with OR, nothing selected meaning all: studying two topics together is normal, and "nothing = all" removes the empty state. AND was rejected.
- Wrapped sticker chips, not one tab per row: all 13 seed topics fit in 6 rows without scrolling.
- Counts only on All and in each chip's accessible name: a count widens every chip by about 20 px and costs rows.
- One live region in the app reads out where you are ("Card 7 of 16", or the end card's text): the cards remount on every move, so a live region inside one never announces.
- Topics in the file's order, coloured by declared index mod 8: the author groups related topics, the order never shifts, and neighbours never share a colour.
- Tap flips; swipe left is next, right is previous within the pass; keys add vim's `h j k l` as in Patric's plant-selection, `s` to reshuffle and `f` for fullscreen.
- A tap is under 10 px and at most 350 ms: a thumb resting on the card must not flip it when it lifts.
- The 8 ms haptic tick comes as a move is decided (a swipe let go past its threshold, a key, a button, a tap on the end card), not as its card lands about 330 ms later, when it confirms nothing and, in rapid flicks, falls on the next touch. `useSwipe`'s `onDecide` and `CardStage`'s `onMove` carry it, beyond plan §11's interfaces. A reshuffle (`s`) and a chip tick at once; a flip never.
- The flip turns around the X axis: sideways motion means navigation, so the flip must not look like one, and on a 5:3 card it sweeps the short side, which is snappier.
- The card follows the finger 1:1, never clamped: a card that stops following fails "extremely smooth".
- A pass is a Fisher–Yates shuffle with no repeats, closed by an end card; a reshuffle never starts with the card just seen, and happens only at launch, at the end card, on `s` and on a selection change. The brief: "cards are just shuffled and shown randomly".
- The card on screen survives a topic change when it still matches: changing topics shouldn't throw away the card being read.
- No scrolling inside a card: validation limits, three fit steps and an end-to-end fit test over the real deck. A card that scrolls is not an index card and fights the swipe.
- Code lines at most 46 characters, never scrolled: a scroller inside a swipeable card fights the swipe.
- No first-run hint: the only user designed the gestures.

Look and motion:

- "Midnight desk": paper card, marker question, ballpoint answer on ruled lines, highlighter bold, riso-bright stickers. Quality from restraint, funk from colour and the bouncy hand.
- Shantell Sans, the full variable file with its informality and bounce axes, and Monaspace Radon for code: Caveat's small x-height needs 26 px or more, Kalam and Bricolage look dated, and Shantell's weight-only file drops the axes that make it look handwritten.
- The card being read stays upright; only the blank cards peeking behind it tilt: crisp text.
- Bold and inline code broken over two lines are sliced, not cloned as plan §7 has it (`box-decoration-break`): in Chromium a cloned inline turns `text-wrap: pretty` off for its whole block, which then ends on a lone word, as 7 backs of the real deck did. The fit allows a highlight's 2u of end padding past the column, which had pushed two backs to step 1 over one invisible pixel.
- The card is designed in card units (600 × 360, `--u`, the `frame` has `container-type: size`): it lays out identically at any size.
- The press scales `lift`, not the dragged layer: the card never trails the finger.
- Flings, departing from plan §4 after the M3 review: a released card flies half its width past −(cardRect.right + 80), on a curve worked out for that distance, so it slows down off screen instead of crawling over the panel; keys and buttons still fly to −(right + 80). A card still flying out when its move lands early (a touch, a key, a button) flies on as a copy (no `data-role`, inert, `aria-hidden`) while the move lands, so in rapid flicks no card vanishes mid-air. The end card, with nothing under it, lands its move as it is let go: the next pass is dealt under it as it flies off.
- The previous card waits with its right edge on the screen's left edge, at −cardRect.right, not plan §4's −(right + 80): a right drag shows it from the first pixel, where the plan's moved nothing for the first 80 px (about 13 mm).
- While a flip or a deal runs, the card underneath shows blank paper (the stage's `data-flipping`, `data-dealing`): near 90° the flipping card is almost edge-on, and a dealt card fades in over it, so the next question must not show through. The deal's is a departure from plan §11, which blanks it for flips only: the M3 review saw both questions superimposed.
- Reduced motion: animations become short fades, but the drag still follows the finger, without rotation; direct manipulation is not motion.
- The fullscreen chip shows only in a browser tab: the installed app is already fullscreen (`display: fullscreen`), locked to landscape.
- The fullscreen chip is an icon-only 44 px sticker named "Full screen": a visible label (121 px) breaks the six-row panel.
- The panel stands beside the card from its top edge to its foot: the shell's one row is exactly as tall as the card, `min(100%, stage width × 3/5)`, and centred. A camera cutout or a wide screen narrows the card; the panel follows.

Stack:

- Gestures and animation are hand-written (pointer events, transforms written straight to the element, the Web Animations API for flings, a CSS transition for the flip), with no motion library: `motion/react` with drag costs about 45 kB gzipped on top of React's 68 kB.
- Plain CSS with tokens and CSS Modules; no Tailwind, no router; TanStack Query for the one fetch.
- Hono on `Bun.serve`, and `hc<Api>` in the client over the routes' inferred types: end-to-end types with no code generation, plus static serving and `app.request()` for tests without a port.
- No OpenAPI chain: openapi-typescript crashes under TypeScript 7 and openapi-fetch is in maintenance mode (Patric: "don't get hung up on openapi-fetch").
- TOML for the deck, parsed by smol-toml: a standard grammar whose errors carry line and column; Bun's own parser doesn't comply (Gotchas).
- Markdown rendered on the server by `Bun.markdown.html` behind an allowlist of tags: no Markdown dependency and no parser in the bundle.
- A service worker (vite-plugin-pwa, `generateSW`): instant start of the installed app and offline reading; the deck is fetched network-first, so cards stay fresh.
- One package, no workspaces; exact pins at least 7 days old (`bunfig.toml`).

Data:

- A card is `question`, `topics` and `answer`, as Patric specified. Its id derives from the question: ids would only matter for spaced repetition, which is out of scope. No version key in the file: nothing would read it.
- Validation is strict and reports every problem at once; the server refuses to start on a bad deck.
- Corrections of the source notes live in TOML comments and `docs/seed.md`, never on a card: commentary about the source is not study material. The notes' stubs get no cards.
- The deck's version (the first 12 characters of the base64url SHA-256 of its canonical JSON) is the ETag and what `/healthz` reports, so a deploy can confirm what it shipped.

Hosting:

- Its own droplet, `flash` in fra1, Caddy in front with `encode zstd gzip`, the server bundled into one `server.js` with no `node_modules`: in line with Patric's other apps.
- `deploy-do.sh up` runs `bun install --frozen-lockfile && bun run verify` first, and no flag skips it: there is no CI, so the gate lives in the deploy.
- `deploy-do.sh cards` ships the deck without code: the most frequent change gets a fast path (about 30 s) that can't touch the code.
- Bun on the droplet is pinned to the laptop's `bun --version`: the droplet runs what the gate tested, and `Bun.markdown` is unstable.
- No robots.txt: a crawler that is disallowed never sees the `noindex`, so `X-Robots-Tag` and the meta tag do the work.

## Conventions

- Strict Beck-style TDD: a failing test first, the simplest change to green, refactor at green, commit at green. Type declarations, configuration, CSS and pure wiring need no test.
- Braced effect bodies only: `useEffect(() => { … })`, never `useEffect(() => expr)`. A returned Promise is called as cleanup and blanks the app; `tests/conventions.test.ts` fails on it.
- Measure text only after `document.fonts.load()`, never on `document.fonts.status`, which reads "loaded" before any face is requested.
- Every visible control is at least 44 × 44 px under a coarse pointer.
- Nothing scrolls sideways at any size: `document.documentElement.scrollWidth === innerWidth`.
- Animate only `transform` and `opacity` (never `box-shadow`).
- No React state during a drag: `pointermove` writes transforms to the element, and a test asserts zero React commits.
- Nothing draggable in the 48 px strip on the right; drags start only on the card; the topic panel takes taps only.
- Set type through `var(--font-hand)` and `var(--font-code)`; never name a family.
- Every size on the card is a multiple of `--u`, used only by the frame's descendants.
- Tests sit beside their module as `x.test.ts(x)`. Import Vitest's APIs explicitly: its globals are on only so Testing Library cleans up after each test.
- Biome with `--error-on-warnings`: two spaces, double quotes, lines up to 120.
- Playwright runs headless only; never a headed browser or anything that opens a window or plays sound.

## Where things are

```text
cards/cards.toml           the deck
shared/types.ts            the wire types, Card and Deck
shared/schema.ts           the Zod schema of the deck file, LIMITS, the wire shape's Zod mirror
shared/glyphs.ts           the characters the two fonts cover, extracted once from the font files
server/markdown.ts         Bun.markdown → allowlisted HTML: line breaks, arrows, attributes stripped
server/deck.ts             TOML text → Deck: slug(), loadDeck(), DeckError listing every problem
server/api.ts              createApi(deck): /api/cards and /healthz; type Api
server/app.ts              createApp({ deck, distDir }): the API, static files, headers
server/main.ts             the Bun entry: environment, load the deck, serve
scripts/check-cards.ts     bun run cards:check [--version]
scripts/budget.ts          the size budgets over dist/
scripts/deploy-do.sh       the droplet: up, cards, link, logs, down
src/main.tsx               the root: QueryClient, StrictMode
src/app/                   App: the desk's layout and the wiring of everything else; useShortcuts
src/api/                   the typed client (hc<Api>), useDeckQuery
src/deck/                  the deck engine: pool, pass, shuffle, selection, useDeck
src/gesture/               the gesture recogniser (GESTURE) and useSwipe
src/motion/timing.ts       the Web Animations durations and easings
src/stage/                 CardStage: the layers, drags, flings, the stack peeking behind; StillStage, the stack under the loading, error and empty cards
src/card/                  CardView, EndCard, MessageCard (loading, error, empty), the fit steps
src/panel/                 TopicPanel, the sticker colours
src/desk/                  the wordmark
src/platform/              fullscreen, wake lock, haptics, the fullscreen chip
src/styles/                tokens.css, fonts.css, global.css (the desk and the page-wide rules)
src/fonts/                 the two woff2 files and their OFL licences
public/                    icon.svg and the PNG icons made from it
tests/fixtures/cards.toml  the fixture deck
tests/e2e/                 the Playwright specs and helpers
tests/screenshots/         the screenshot baselines, by project
tests/conventions.test.ts  conventions checked on the sources by regex
docs/                      original-request.md, plan.md, cards.md, seed.md
```

- The stage and the card meet at a DOM contract (plan §11), outer to inner: `stage` › `layer[data-role="prev|current|next"]` › `lift` › `frame` › `flipper` › two `face`s. `CardStage` takes a `renderCard` prop, so it never imports the card.
- `server/api.ts` imports nothing Bun-specific: the client imports its type.
- `tsconfig.json` is the browser program (DOM and `vite/client`, no Bun or Node types): `src`, `shared`, `tests/conventions.test.ts`, and `server/api.ts` through the client's type import. `tsconfig.node.json` is the Bun program (`bun` types, plus the DOM lib for `page.evaluate` callbacks): `server`, `scripts`, `shared`, `tests/e2e`, the config files. Both: TypeScript 7 (native `tsc`), `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (types via `import type`), bundler resolution, extensionless imports.
- Hono: `import { serveStatic } from "@hono/bun"` on the server; `import { hc } from "hono/client"` with `hc<Api>` in the client.
- Fonts: `"Shantell Sans"` (variable: `font-weight` 300–800; `font-variation-settings` `"INFM"` 0–100, `"BNCE"` −100–100, `"SPAC"` 0–100) and `"Monaspace Radon"` (400 only), declared in `src/styles/fonts.css`. `index.html` preloads Shantell from `/src/fonts/`, which Vite rewrites to the hashed `/assets/` URL the CSS uses.
- Tokens are custom properties on `:root` in `src/styles/tokens.css`, including `--flip-duration`, `--flip-easing` and `--flip-fade-duration`.

## Commands and tests

- `bun run test`: Vitest (happy-dom) for `src/**/*.test.{ts,tsx}` and `tests/conventions.test.ts`, then `bun test ./server ./scripts ./shared`.
- `bun run e2e`: Playwright over `tests/e2e/`, headless, against `build/server.js`, so build first.
- `bun run typecheck`: `tsc` on `tsconfig.json`, then `tsconfig.node.json`.
- `bun run lint`: Biome; `bunx biome check --write .` fixes formatting and import order. It skips `var/`, the gitignored scratch directory for throwaway harnesses.
- `bun run build`: Vite into `dist/`, the server into `build/server.js`.
- `bun run cards:check` and `bun run budget`; `bun run verify` runs `cards:check`, `typecheck`, `lint`, `test`, `build`, `budget` and `e2e`, in that order.
- `scripts/deploy-do.test.ts` needs `shellcheck` on the path. It only checks the script's syntax, lint and usage: never run the script with a subcommand from a test.
- Playwright projects: `pixel11` (923 × 412, DPR 2.625, touch), `portrait` (412 × 923) and `laptop` (1280 × 800, fine pointer); en-GB, Europe/Zurich. `perf` is the Pixel 11 again, for `perf.spec.ts` alone, after the other three: timings taken while other specs share the CPU are noise. Selecting it (`--project perf`) runs the whole suite first. Port 4173 serves `tests/fixtures/cards.toml` and is the base URL; 4174 serves `cards/cards.toml` (`test.use({ baseURL: "http://127.0.0.1:4174" })`), for the fit test. Service workers are blocked unless a spec sets `test.use({ serviceWorkers: "allow" })`. Screenshots go to `tests/screenshots/<project>/<name>.png`, so names are unique across specs; `animations: "disabled"`, `caret: "hide"` and `maxDiffPixelRatio: 0.001` are the defaults.
- The fixture deck: 9 cards, 7 topics (Redis, Postgres, Queues, Consistency, Sharding, Real-time, Case studies; Consistency has one card, Postgres and Queues three). It covers every markup feature; one card has three topics, one question is exactly 100 characters, and the shard-key answer (498 characters, 12 lines) needs fit step 2. Its 64-character ids rely on `slug()` truncating. Keep it valid by every rule.

## Shipping cards versus code

- **Cards**: edit `cards/cards.toml`, `bun run cards:check`, commit and push, then `scripts/deploy-do.sh cards`: the check, the fit test on the real deck (`tests/e2e/fit.spec.ts`, which the script runs by name; building first only if `dist/` or `build/server.js` is missing), one file uploaded, a restart, and the health check. It never ships code. The phone shows the new deck on the next launch.
- **Code**: commit and push, then `scripts/deploy-do.sh up`: the gate, `build/release/` staged (`server.js`, `dist/`, `cards/cards.toml`) and sent with one `rsync -az --delete`, a restart, and the health check. The phone runs the new code one launch late.
- **The health check**: `/healthz` on the droplet first (its journal printed if the server won't start), then https://flash.patforna.com/healthz from the laptop, whose `version` must equal `bun scripts/check-cards.ts --version cards/cards.toml`, retried for up to 2 minutes while a new droplet's DNS record and certificate come up.
- `link` prints the address, `logs` the server's journal; `down` deletes the droplet and its A record.

## Gotchas

- **Bun's TOML parser**: `Bun.TOML.parse` (1.3.14) keeps the line break after an opening `'''`, which TOML 1.0 trims, and its errors carry no line or column. Hence smol-toml.
- **openapi-typescript and TypeScript 7**: openapi-typescript 7.13.0 crashes under TypeScript 7.0.2 (`ts.factory` is gone; upstream #2841). TypeScript 7's main export is only its version (the compiler API sits under `typescript/unstable/*`), so the conventions test reads the sources with regexes.
- **`Bun.markdown` is unstable**: Bun is pinned and the renderer tested. Tables, strikethrough and task lists are on by default despite Bun's docs, so they are switched off; `hardSoftBreaks` does nothing in 1.3.14, so the renderer turns line breaks into `<br>` itself.
- **The Android back gesture**: in the installed fullscreen app, a swipe from either edge means back (up to 40 dp per side, with no web opt-out). Hence the 48 px strip on the right, drags only from the card and a panel that takes taps only. Emulation can't show it: check on the phone.
- **The fullscreen chip in Playwright**: every Playwright page is `display-mode: browser` with fullscreen enabled (CDP can't emulate the display mode), so the chip always shows. A key-triggered `requestFullscreen` does switch headless Chromium to `display-mode: fullscreen`, so `pixel11` screenshots and layout checks press `f` first, except the one of the chip in a tab.
- **The hostname is public**: it is in the Certificate Transparency logs from the moment Caddy gets its certificate. `noindex` only keeps it out of search results; never put private material in cards.
- **Caddy's one-line blocks**: Caddy can't parse a site block written on one line (`{` must end its line and `}` stand on its own), so the deploy script writes it over several lines.
- **The service-worker kill switch**: if a broken worker strands the phone, add `selfDestroying: true` to the `VitePWA` options in `vite.config.ts` and redeploy; the new worker removes itself and its caches.
- **A code change shows one launch late**: `registerSW.js` only registers, so the new worker installs in the background while the open page keeps the old bundle. A card change shows on the next launch, since the deck is fetched network-first. The deck is cached only once a controlled page has fetched it: the first load's preload runs before the worker controls the page.
- `animation.finish()` notifies late (`finished` a microtask later, `onfinish` a frame later): call `finish()`, then complete the commit synchronously with `flushSync` before reading the layers.
- A finished animation that fills stays in `document.getAnimations()` and overrides inline transforms, freezing the next drag: every animation ends at its resting style, or writes its end state inline and is cancelled in the frame it ends.
- `perspective` on the stage reaches only its direct children, so the flipper's own transform carries `perspective(1400px)`. `overflow`, `opacity`, `filter`, `clip-path`, `mask` or `contain: paint` on the flipper flatten it and break `backface-visibility`.
- `--u` on the `frame` element itself resolves against the stage: use it only in the frame's descendants, and never register it with `@property`.
- Inline code needs `line-height: 0`, or each line with code grows by about 2 px and the writing drifts off the rules.
- Shantell lacks → ← ↔ ≤ ≥ ≈ ≠ ∞: the `--font-hand` stack falls back to Radon for them.
- Measure interaction latency with Event Timing (`PerformanceObserver({ type: "event" })`), not a DevTools trace, which inflates DOM-churn timings.
- Event Timing in headless Chromium is mostly pipeline: a tap's touch events wait about a frame before they are dispatched and are presented one or two frames later, so at 4× CPU a tap's entries read 16–40 ms, of which the app's own processing is about 8 ms. While a measured frame is on its way, leave the page alone: `settled()` polls `document.getAnimations()`, which forces style into the frames being measured.
- CDP answers `Input.dispatchTouchEvent` for a move before the page sees it (moves are dispatched with the next frame): poll for the effect of the last move rather than reading it at once.
- happy-dom 21 has no `document.fonts`, no `document.getAnimations` and no layout; `(pointer: coarse)` is false; `fullscreenEnabled`, `navigator.vibrate` and `navigator.wakeLock` are undefined; `PointerEvent` ignores `timeStamp` in its init (set it with `Object.defineProperty`). Stub or inject these; everything visual belongs to Playwright.
- Outside CI, Playwright reuses a server already listening on 4173 or 4174: a stale one makes the tests, including the fit test `deploy-do.sh cards` runs, use an old build or deck.
- `hono/bun`'s `serveStatic` is deprecated (gone in v5): use `@hono/bun`'s. Neither sends an ETag for static files.
- Vitest's persistent module cache (`fsModuleCache`) is off: it kept a test's `import.meta.glob` expansion until the test file itself changed, so the conventions test never saw a new source file.

## Current state

- 30 Oct 2026, integration (M2a): the seven packages merged and wired in `App`; `cards:check`, `typecheck`, `lint`, `test`, `build` and `budget` pass, and so does `tests/e2e/pwa.spec.ts`. The real deck has 66 cards in 13 topics; every card fits, two backs at step 1.
- 30 Oct 2026, end to end (M2b): the Playwright suite in `tests/e2e/` (reading, topics, keyboard, fit, layout, a11y, perf, screens, pwa) and its baselines; `verify` passes end to end. The fit spec is `tests/e2e/fit.spec.ts`, which `deploy-do.sh cards` runs by name.
- Next: the review (M3) and the first deploy (M4). Not deployed yet.
