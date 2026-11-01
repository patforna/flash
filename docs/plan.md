# flash v0: the plan

The synthesis of three independent plans (panel of 30 Oct 2026: Codex at `xhigh`, Claude Opus 5.5 and Claude Fable 5.1 at `max`; raw answers and brief archived outside the repository), merged with `/at:synthesize`, plus Patric's later direction: **TypeScript 7 and whatever is state of the art; don't get hung up on openapi-fetch**. Part 1 records how it was merged. Part 2 is the spec the build follows. `docs/original-request.md` wins over both.

---

# Part 1: synthesis record

## Flags: content that went beyond or against the brief

- **Authored cards for the stubs** (Fable: write "Scaling writes" and "Webhooks" from general knowledge). The brief says *extract* from the notes. Dropped: stubs get no cards and are listed in a comment.
- **Correction notes on the cards** (Fable: an italic `✎ The notes said …` line on the card). Meta-commentary about the source is not study material. Dropped: corrections live in TOML comments, `docs/cards.md` and the hand-off email.
- **An `id` field on every card** (Codex, Opus). Patric specified `(question, answer, topics[])`; ids were justified by future spaced repetition, which is out of scope. Dropped: the id is derived from the question.
- **A `version = 1` key in the data file** (Codex). Nothing reads it. Dropped.
- **Clamping the drag to 96 px** (Codex). A card that stops following the finger fails "extremely smooth". Dropped: the card follows 1:1.
- **Horizontally scrolling code blocks** (Codex). A scroller inside a swipeable card fights the swipe. Dropped: code lines are length-limited instead.
- **A first-run gesture hint** (Opus). The only user designed the gestures. Dropped (YAGNI).
- **TypeScript 6.0.3 and the OpenAPI → openapi-typescript → openapi-fetch chain** (Opus; Codex used native fetch, Fable openapi-fetch). Superseded by Patric's direction. Verified: openapi-typescript 7.13.0 crashes under TypeScript 7.0.2 (`ts.factory` is gone; upstream #2841), and the maintainers put openapi-fetch and openapi-react-query into maintenance mode in their 2026 roadmap (openapi-ts discussion #2559). Replaced by Hono's typed RPC client over shared Zod types: end-to-end types, no code generation, checked to type-check under `typescript@7.0.2`.

## Agreements (taken directly)

- The whole notes file is seeded; `:119` is a cursor position (all three).
- Topics are chosen in a permanent panel on the left that uses width the 5:3 card cannot use; nothing takes height (all three).
- OR semantics; AND rejected (all three).
- Tap anywhere on the card flips it; swipe left is next; swipe right is previous within the current pass; keyboard equivalents (all three).
- Gestures and animation are hand-written: pointer events, transforms written straight to the element during a drag with no React render, the Web Animations API for flings and a CSS transition for the flip. No motion library (all three; Opus measured `motion/react` with drag at +45 kB gzipped on React's 68 kB).
- Plain CSS with tokens and CSS Modules; no Tailwind (all three). No router (all three). TanStack Query for the one fetch (all three).
- A pass is a Fisher–Yates shuffle with no repeats; previous works within the pass (all three).
- A dark desk; a paper card with a blank front and a ruled back with a red header line; the question echoed in the back's header; a fixed palette of topic colours; self-hosted fonts (all three).
- `viewport-fit=cover` with safe-area insets; a manifest locked to landscape; an in-tab fullscreen control that also locks orientation (all three). `display: "fullscreen"` (Opus, Fable).
- Reduced motion honoured; a short vibration on commit (all three).
- Data validated strictly; every problem reported at once; the server refuses to start on bad data (all three).
- Deployment: droplet `flash` in fra1, `s-1vcpu-512mb-10gb`, tag `web-app`, monitoring on, `/opt/flash`, `flash.service`, Caddy with `encode zstd gzip`, no bare-IP block, no key; the server bundled into one file with `bun build`; a cards-only fast path; a health check; noindex (all three).
- One package, no workspaces (all three).
- An end card closes each pass and reshuffles (Opus, Fable). The card on screen survives a topic change if it still matches (Opus, Fable).
- TOML for the data (Codex, Opus). A service worker for instant start and offline reading (Codex, Opus).
- About 65 cards, one idea per card (Opus, Fable). Stubs not carded (Codex, Opus). Corrections not shown in the app (Codex, Opus).
- Vitest with happy-dom and Testing Library for components; Playwright Chromium with a custom Pixel 11 landscape descriptor, CDP touch for swipes, screenshot baselines, axe and performance budgets (all three; Event Timing and Long Animation Frames from Opus and Fable).

## Contradictions, decided on substance

- **Single or multi-select topics.** Multi-select (Opus, Fable) over single (Codex): studying two topics together ("Redis + Postgres") is a normal session, toggles cost nothing more than radios, and "nothing selected = all" removes the empty state.
- **One tab per row or wrapped chips.** Wrapped sticker chips (Opus) over one divider tab per row (Codex, Fable): at 44 px a row, 13 one-per-row tabs need about 640 px of a 364 px column and scroll, hiding part of the selection; wrapped chips show all 13 in about 6 rows. The divider charm survives in the sticker styling.
- **Counts on chips.** Only on "All" and in each chip's accessible name (Opus): a count widens every chip by about 20 px and costs rows. The card's counter shows the size of the current pass.
- **Topic order and colour.** Declared order in the file (Opus) over alphabetical (Codex, Fable): the author can group related topics and the order never shifts. Colour by declared index mod 8 (Opus) over a hash (Fable): neighbours never share a colour.
- **TOML or Markdown-by-heading.** TOML (Codex, Opus) over one card per `##` heading (Fable): a standard grammar with a parser that reports line and column, against a bespoke convention that needs a fence-aware parser. Parser: smol-toml (verified: Bun 1.3.14's `Bun.TOML.parse` keeps the newline after an opening `'''`, which TOML 1.0 says to trim, and its errors carry no location; smol-toml's show line, column and context).
- **Answer markup.** Standard Markdown rendered on the server by Bun's built-in `Bun.markdown.html` (a gap, see below), restricted by an allowlist of output tags. Over Opus's bespoke parser (more code to own), Fable's `marked` (a dependency Bun already replaces) and Codex's client-side `react-markdown` (a parser in the bundle).
- **Server.** Hono on `Bun.serve` (Fable) over plain `Bun.serve` (Codex, Opus). With the OpenAPI chain gone, Hono's RPC client is what carries the types to the client; it also brings static serving with MIME types and traversal protection, ETag handling and `app.request()` for port-free tests.
- **Service worker.** Yes (Codex, Opus) over no (Fable): instant start of the installed app and offline reading on a train are real for a phone study app. Fable's risk (stale cards after a deploy) is handled by fetching the deck network-first.
- **Flip axis.** Around the X axis, top over bottom (Opus), over Y (Codex, Fable): sideways motion means navigation, so the flip must not look like one; on a 5:3 card it also sweeps the short side, which is snappier. One token if Patric prefers the other.
- **Long answers.** No scrolling inside a card (Opus): validation limits, three fit steps and an end-to-end fit test over the real deck that fails the build. Over scroll regions (Codex, Fable): a card that scrolls is not an index card and fights the swipe.
- **Fonts.** Shantell Sans, variable with its informality and bounce axes, for all handwriting, and Monaspace Radon for code (Opus; Radon also Fable). Over Caveat with Permanent Marker (Fable: Caveat's small x-height needs 26 px or more for answers) and Kalam with Bricolage (Codex: looks dated).
- **Tilt.** The card being read stays upright for crisp text; only the blank cards peeking behind it are tilted (over Fable's seeded tilt on every card).
- **Tap timing.** At most 350 ms (Fable) over 500 ms (Opus): a thumb resting on the card must not flip it when it lifts.
- **Keys.** Arrows plus `h j k l` as in Patric's plant-selection (`h` previous, `l` next, `j`/`k` flip), `s` reshuffle, `f` fullscreen (Fable), over J/K for next and previous (Opus).
- **robots.txt.** None (Opus): a crawler that is disallowed never sees the `noindex`. `X-Robots-Tag` and the meta tag do the work.

## Unique points, re-examined

- Kept (Opus): the Android back gesture (an edge swipe means back in the installed fullscreen app, up to 40 dp per side, no web opt-out), so the card keeps 48 px from the right edge, drags start only on the card and the left panel only takes taps; the card designed in 600 × 360 container units so it lays out identically at any size; wake lock while reading, released after 5 minutes idle; the thinning stack; highlighter bold; the colour band on the front; the fullscreen chip only in a browser tab; Bun on the droplet pinned to the laptop's version; `minimumReleaseAge` of 7 days in `bunfig.toml`; zero React commits during a drag as a test; a conventions test against expression-bodied effects.
- Kept (Fable): the end card's copy and behaviour; the red rule overshooting the text column; `navigationUI: "hide"`; the vim keys.
- Kept (Codex): the reshuffle never starts a new pass with the card just seen (also Opus); a seed audit, as `docs/seed.md`.
- Discarded: Codex's `docs/design.md` (folded into CLAUDE.md and `tokens.css` comments); Fable's `docs/PLAN.md` updated as agents go (this file is frozen; CLAUDE.md holds current state).

## Gaps: what no panelist caught

- **Bun's built-in Markdown renderer.** Bun 1.3.14 ships `Bun.markdown.html` with `noHtmlBlocks`, `noHtmlSpans` and `noIndentedCodeBlocks`; checked to escape raw HTML. It removes every Markdown dependency. (Its `hardSoftBreaks` turned out to do nothing in 1.3.14; the renderer adds the line breaks itself, section 9.)

## Review of this plan (an independent critic, 30 Oct)

Twenty findings, all verified by experiment and folded into Part 2 in place: flings measured from the viewport, not the stage; chips resized so all 13 seed topics fit; Markdown line breaks, structure checks and escaped arrows; the flip's perspective and 3D context; animation lifecycle traps (`finish()` notifies late, filled animations linger); the next card hidden while a flip runs; a frozen DOM contract between the stage and the card; inline code kept on the ruling; glyph coverage; interface fixes (`clearTopics`, the stage owns the shortcuts); Playwright realities (the fullscreen chip, the safe-area override, the service worker's first load); TypeScript 7 specifics; `@hono/bun`; designed loading and error cards. Raw findings: an archive outside the repository.
- **A typed client without OpenAPI.** Moot until Patric's direction; Hono RPC with Zod checked under TypeScript 7.0.2 (`@ts-expect-error` on a wrong type is consumed, so the types are real).
- **Only Opus caught** the Android back-gesture conflict and Bun's TOML non-compliance.
- **Nobody can verify on the real Pixel** what emulation cannot show: 120 Hz feel, haptics, the back gesture, wake lock. The hand-off lists a two-minute on-phone check.

---

# Part 2: the spec

## 1. Product

One screen. A paper index card on a dark desk, a panel of topic stickers on its left. Tap the card to turn it over; swipe it away for the next one; swipe back for the previous one. Cards come from `cards/cards.toml`, edited outside the app and shipped with `scripts/deploy-do.sh cards`. Reading only. No auth.

## 2. Geometry (Pixel 11, fullscreen landscape: 923 × 412 CSS px, DPR 2.625)

- Shell: `height: 100dvh; overflow: hidden`; a two-column grid, panel then stage.
- Padding: top and bottom 24 px; left `max(12px, env(safe-area-inset-left) + 8px)`; right `max(48px, env(safe-area-inset-right) + 16px)`. The 48 px on the right is the no-drag strip for the Android back gesture; nothing draggable sits in it.
- Panel: 232 px wide, top-aligned with the card; the column gap to the stage is at most 24 px.
- Card: the largest 5:3 box that fits the stage, centred; about 607 × 364 on the Pixel. Its content is laid out in **card units**: designed at 600 × 360, the `frame` element (section 11, DOM contract) has `container-type: size`, and inside it `--u: calc(100cqh / 360)`, every size on the card a multiple of `--u` (1u ≈ 1.01 px on the Pixel). `--u` is used only by the frame's descendants (on the frame itself it resolves against the stage) and is never registered with `@property`.
- The stage does not clip and sits above the panel in z-order, so a flung card travels over the panel and off the screen; only the shell clips (`overflow: hidden`).
- Portrait (a browser tab only; the installed app is locked to landscape): the card on top at full width with 16 px gutters, chips wrapping below it in a scrolling area. Functional, not polished.
- Nothing scrolls sideways at any size: `document.documentElement.scrollWidth === innerWidth`.

## 3. Topic panel

- Order: the fullscreen chip (only in a browser tab, section 6), then **All**, then each topic in the order declared in the file.
- Multi-select toggles. A card is in the pool if it carries **any** selected topic. Nothing selected means all cards.
- **All**: reads "All · 65" (the deck total). Pressed exactly when nothing is selected. Tapping it with a selection clears it; with none, does nothing. Deselecting the last topic returns to All. Selecting every topic is allowed and is not turned back into All.
- No counts on topic chips; each chip's accessible name carries its count ("Redis, 17 cards").
- Chips: 44 px tall, padding 0 10 px, natural width, wrapping with 6 px gaps; label `var(--font-hand)` 14 px, weight 600, informality 25. Measured with the real font: the fullscreen chip, All and the 13 seed topics fit in 6 rows (294 px), leaving room for the wordmark. A layout test asserts every seed chip is fully visible without scrolling at 923 × 412.
  - Unselected: a 1.5 px outline in the topic's colour at 60 %, `--chalk` label, no dot.
  - Selected: filled with the topic's colour, `--sticker-ink` label, a hard shadow drawn by a pseudo-element offset `3px 3px` in black, tilted by a deterministic ±1.5° from its index, like a stuck-on sticker.
  - Pressed: the chip moves `translate(2px, 2px)` while its shadow pseudo-element moves `translate(−2px, −2px)`, so the shadow seems to shrink to 1 px; 90 ms; transforms only (never animate `box-shadow`).
  - Focus: 3 px `--hl` ring, offset 2 px.
- Colour: declared index mod 8 → `--s-pink`, `--s-marigold`, `--s-mint`, `--s-sky`, `--s-lilac`, `--s-tangerine`, `--s-teal`, `--s-lime`.
- Overflow (40 topics): the panel scrolls vertically, `overscroll-behavior: contain`, a 24 px fade at the bottom edge.
- Persistence: `localStorage["flash:v1:topics"]`, a JSON array of labels, written on change, read once at start; unknown labels dropped; storage errors ignored.
- On change: the pool is recomputed and the pass reselected (section 5); history resets; an 8 ms haptic tick.
- Semantics: `role="group" aria-label="Topics"`; each chip a `<button aria-pressed>`.
- The panel takes taps only, never drags (left-edge back gesture).
- Bottom-left of the panel: the "flash" wordmark, Shantell 22 px, weight 700, informality 100, bounce 50, `--hl` at 85 %, `aria-hidden`.

## 4. Reading

### Inputs

- **Tap** (moves under 10 px and lasts at most 350 ms) anywhere on the card: flip, front ↔ back. A longer hold does nothing.
- **Swipe left**, starting on the card: next card, from either side (so a card can be skipped unread).
- **Swipe right**, starting on the card: previous card; rubber-bands on the first card of a pass.
- **Vertical drag**: nothing (native scroll only in the last-resort overflow case, section 8).
- **End card**: tap or swipe left reshuffles and deals; swipe right goes back to the last card.
- **Keys**: Space, Enter, ↑, ↓, `j`, `k` flip; →, `l`, PageDown next; ←, `h`, PageUp previous; `s` reshuffle; `f` toggle fullscreen. Nothing fires while typing, with Alt, Ctrl or Meta, or for Space/Enter while a button has focus (the button handles them).
- **Buttons for keyboards and screen readers**: "Show answer" / "Show question", "Previous", "Next". Visually hidden until focused under a coarse pointer; with a fine pointer, ‹ › fade in on hover at the card's side edges.

### Gesture recogniser (`GESTURE` constants)

- Slop 10 px: below it, still a possible tap.
- Axis lock when the slop is crossed: horizontal if |dx| ≥ 1.2·|dy|, otherwise vertical and ignored.
- Commit in the drag direction if |dx| ≥ 28 % of the card width (about 170 px), **or** velocity ≥ 0.45 px/ms with |dx| ≥ 24 px. A fling against the drag direction (|v| ≥ 0.45 px/ms with the opposite sign to dx) cancels, whatever dx is. Otherwise cancel.
- Velocity: least-squares slope over the last 80 ms of samples, including `getCoalescedEvents()`.
- Only the first pointer counts, and only if it went down on the card; `setPointerCapture`. `pointercancel` is a cancel.
- **Input during an animation**: a pointerdown finishes any commit, cancel or deal animation at once, nothing queued or dropped, so rapid flicks stay snappy. `animation.finish()` notifies late (its `finished` promise a microtask later, `onfinish` a frame later), so the stage calls `finish()` and then completes the commit synchronously (`flushSync(() => onCommit(dir))`) before it reads `layers()`. The flip transition is not finished by a pointerdown (a tap mid-flip reverses it from the current angle); it is finished only once a horizontal drag is recognised.

### What follows the finger (written to `style.transform` in `pointermove`; no React render)

- Distances are measured from the viewport at pointerdown, not from the stage: `cardRect` is the current card's `getBoundingClientRect()`.
- Current card: `translateX(dx)` 1:1, `rotate(clamp(dx × 0.03°, −7°, 7°))`, `transform-origin: 50% 140%` (it pivots under the thumb).
- The card underneath, with progress p = min(|dx| / commit distance, 1): `scale(0.965 + 0.035p) translateY(8(1 − p)px)`.
- Previous card: rests at `translateX(−(cardRect.right + 80px))` with `visibility: hidden`; it becomes visible on the first right-drag move and follows at x = −(cardRect.right + 80) + dx.
- Rubber band with no previous card: x = 80 · (1 − 1 / (0.55·dx/80 + 1)).
- Layers not in play are `visibility: hidden; pointer-events: none`, so nothing off-card ever blocks a chip.

### Motion (transform and opacity only)

- **Flip**: the `flipper` element's own transform is `perspective(1400px) rotateX(0 ↔ −180deg)` (a `perspective` property on the stage reaches only its direct children, so the flip would render flat); the flipper has `transform-style: preserve-3d` and no `overflow`, `opacity`, `filter`, `clip-path`, `mask` or `contain: paint` (any of these flattens it and breaks `backface-visibility`); radius, grain, clipping and the shadow go on each face, so the shadow turns with the card. Both faces `backface-visibility: hidden`, the back pre-rotated so it reads upright. 380 ms `cubic-bezier(0.3, 1.2, 0.45, 1)` as a CSS transition, so a tap mid-flip reverses from the current angle. Reduced motion: 140 ms cross-fade.
- **While a flip runs** the stage sets `data-flipping`, and the card underneath shows blank paper (its content `visibility: hidden`): near 90° the flipping card is almost edge-on, and the next card's question must not show through.
- **Commit** (fling out): next flies to `translateX(−(cardRect.right + 80px))`, previous slides in to 0 from its rest; `rotate` ±10°; duration T = clamp(3.5 · remaining / max(|v|, 0.6), 180, 320) ms; easing per release `cubic-bezier(0.2, y1, 0.3, 1)` with y1 = clamp(0.2 · |v| · T / remaining, 0.1, 0.7), so the card leaves at the speed it was released, even when T is clamped. The card underneath rises over the same T. Reduced motion: 140 ms fade.
- **Cancel**: back to 0 in 260 ms, `cubic-bezier(0.3, 1.25, 0.5, 1)`. Reduced motion: 120 ms, no overshoot.
- **Deal** (reshuffle, or a selection change that replaces the card on screen; never when the card on screen survives): `translateY(14px) → 0`, opacity 0 → 1, 220 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`. Reduced motion: 140 ms fade.
- **Press** on pointerdown: the `lift` element scales to 1.012 and the faces' shadow pseudo-elements go from opacity 0.6 to 1, 120 ms ease-out. The press lives on `lift`, not on the dragged layer, so the card never trails the finger.
- Reduced motion: the drag still follows the finger (direct manipulation is not motion) but without rotation.
- **No animation is left filling**: each ends at the resting style, or writes its end state inline and is cancelled in the frame it ends. Only the commit fling uses `fill: "forwards"`, and the post-commit layout effect cancels it and clears inline transforms before paint, so the swap never flickers. (A finished filling animation stays in `document.getAnimations()` and overrides inline transforms, freezing the next drag.)
- Haptics: `navigator.vibrate(8)` on commit (next, previous, reshuffle) and on a chip toggle; never on flip; only under `(pointer: coarse)`; wrapped in try.

## 5. Deck semantics

- **Pool**: the cards carrying any selected topic, in file order; all cards when nothing is selected.
- **Pass**: a Fisher–Yates shuffle of the pool with an injectable `Rng` (`Math.random` in production). `index` runs from 0 to `order.length`; `index === order.length` is the end card.
- `next`: one forward; past the last card, the end card. From the end card: reshuffle.
- `prev`: one back; a no-op at 0.
- `flip`: toggles the side. **Every card you land on shows its front**, including going back.
- `reshuffle` (end card, `s`): a new pass of the pool; if its first card is the card just seen, swap it with a random other position.
- `reselect` (selection change): if the card on screen is still in the new pool, the new pass is `[current, ...shuffle(rest)]` at index 0 on the same side; otherwise a fresh pass is dealt, front up.
- Reshuffles happen only at launch, at the end card, on `s` and on a selection change; never mid-pass. Nothing but the selection survives a reload.
- **End card**: front style, a big hand-drawn highlighter tick (an SVG path: no font has a ✓ that matches), "That's all 16." and "Tap or swipe to shuffle again."
- **Loading** (the deck takes more than 200 ms): the card stack with a blank card reading "shuffling…" in pencil. **Error** (the query failed after its retries): a card in red ink, "Can't reach the deck." and "Tap to try again", the whole card one button that refetches. **Empty** (defensive; validation makes it impossible): "No cards here." All three are `MessageCard` (section 11), the same paper and fonts as a card.

## 6. Platform

- **Manifest** (from vite-plugin-pwa): `id "/"`, `name` and `short_name "flash"`, `lang "en-GB"`, `start_url "/"`, `scope "/"`, `display "fullscreen"`, `orientation "landscape"`, `background_color` and `theme_color` `#11131A`; icons 192, 512 and maskable 512, generated once from `public/icon.svg` (designed to read on the desk colour, which Android 12+ uses for the splash).
- **Installing**: Chrome ⋮ → **Install** (not "Create shortcut", which opens in a tab). Since Chrome 108 a menu install needs no service worker; flash ships one anyway.
- **Fullscreen chip** (corner-brackets icon), first in the panel, shown only under `(display-mode: browser)` when `document.fullscreenEnabled` and not already fullscreen. On click: `document.documentElement.requestFullscreen({ navigationUI: "hide" })`, then `screen.orientation.lock("landscape")`, both failures swallowed. `f` toggles the same.
- **Wake lock**: `navigator.wakeLock.request("screen")` after the first interaction; requested again when `visibilitychange` makes the page visible; released after 5 minutes without input.
- **Service worker** (vite-plugin-pwa `generateSW`): `registerType "autoUpdate"`, `injectRegister "script-defer"`, `skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`; precache `**/*.{js,css,html,woff2,svg,png,webmanifest}`; `/api/cards` `NetworkFirst` in cache `flash-deck`, `networkTimeoutSeconds: 2`, one entry; `navigateFallback "/index.html"` excluding `/api/` and `/healthz`. Kill switch: `selfDestroying: true` and redeploy. The generated `registerSW.js` only registers (no reload on update), so a card change shows on the next launch and a code change on the one after; the deck is only cached once a controlled page has fetched it (the first load's preload runs before the worker controls the page).
- **index.html**: viewport `width=device-width, initial-scale=1, viewport-fit=cover`; `theme-color #11131A`; `<meta name="robots" content="noindex, nofollow">`; an inline style painting `html, body` in `#11131A` (no white first paint); a preload of the Shantell font and `<link rel="preload" href="/api/cards" as="fetch" crossorigin>` so the deck downloads alongside the script.
- **Global CSS**: `overscroll-behavior: none` on `html` and `body` (no pull-to-refresh, no swipe-back in tabs); `touch-action: manipulation` everywhere; `touch-action: pan-y` on the card; `-webkit-tap-highlight-color: transparent`; no text selection or callouts on the card and the panel.

## 7. Visual design: "midnight desk"

Index cards written by hand: marker for the question, ballpoint for the answer, highlighter for what matters, on a near-black desk with riso-bright topic stickers. Quality from restraint: one card, real ruling, paper grain, precise type. Funk from colour, the bouncy hand and the tactile stickers. No rounded white panels, no grey chrome, no light theme.

### Tokens (`src/styles/tokens.css`)

- `--desk #11131A` (desk, theme and manifest colour), `--desk-glow #1A1E2B` (radial ellipse behind the card).
- `--paper #FFFDF6`, `--paper-shade #F1EBDB` (cards peeking behind), `--paper-edge #E2D9C2` (1 px edge).
- `--rule-blue #A9CBEA`, `--rule-red #EE5D6C`.
- `--ink-marker #15171F` (question), `--ink-pen #1F2D6B` (answer, 12.6:1 on paper), `--ink-pen-soft #4A5585` (back header, 7.0:1), `--ink-pencil #5F6475` (counter, on-card topics, 5.8:1).
- `--hl #FFF04D` (highlighter: bold, focus ring, wordmark), `--code-wash rgb(31 45 107 / 7%)`.
- `--chalk #ECEAE3` (chip labels on the desk), `--chalk-dim #9A9DAA` (secondary desk text, 6.9:1), `--sticker-ink #121318` (text on stickers, at least 7.6:1 on all eight).
- Stickers: `--s-pink #FF7AA8`, `--s-marigold #FFC93C`, `--s-mint #45E0A0`, `--s-sky #6CB6FF`, `--s-lilac #BFA2FF`, `--s-tangerine #FF9150`, `--s-teal #34D1C1`, `--s-lime #D7F25A`.
- Motion: flip duration and easing as custom properties; the WAAPI timings live in `src/motion/timing.ts`.

### Fonts (OFL-1.1, copied into `src/fonts/` with their licences; no runtime font dependency)

- **Shantell Sans**, variable, the full file with the `wght` 300–800, `INFM` 0–100, `BNCE` −100–100 and `SPAC` axes (Fontsource 5.3.0 `shantell-sans-latin-full-normal.woff2`, about 174 kB; the weight-only file drops the axes that make it look handwritten). `font-display: block`, preloaded.
- **Monaspace Radon** 400 for code and the counter's digits (Fontsource 5.3.0 `monaspace-radon-latin-400-normal.woff2`, about 57 kB). `font-display: swap`.
- Gate measurement on `document.fonts.load()` / `document.fonts.check()`, never `document.fonts.status`.
- Set type through the stacks `var(--font-hand)` (Shantell, then Radon, which carries the → ← ≤ ≥ ≈ that Shantell lacks) and `var(--font-code)`; never name a family directly.

### Type (card units unless px)

- Front question: 34/40 → 30/36 → 26/31 (fit steps), weight 560, informality 100, bounce 35, `--ink-marker`, centred, `text-wrap: balance`, at most 4 lines.
- Back header (the question again): 15/18, weight 500, informality 40, `--ink-pen-soft`, at most 2 lines.
- Answer: 21/30 → 19/27 → 17/24, weight 430, informality 60, bounce 10, `--ink-pen`. The rule pitch follows the step so the writing stays on the lines.
- Bold: the answer's size, weight 620, on a highlighter band.
- Code: Radon at 0.86 em inline, 0.82 em in blocks, line height = the rule pitch.
- On-card topics and counter: 12/14, weight 500, informality 30, `--ink-pencil`; counter digits in Radon so they don't jitter ("07 / 16").

### Card anatomy

- 5:3, corner radius 6u, `--paper` with an SVG `feTurbulence` grain at 4 %, a 1 px `--paper-edge`, a long soft shadow. Upright.
- Up to two blank `--paper-shade` cards peek out behind, rotated −1.8° and +1.1°: the first while at least 2 cards remain after the current one, the second while at least 3 do, so the stack visibly thins.
- **Front**: a 6u band along the top edge in the first topic's colour; the question centred; bottom-left the card's topics as dots with labels; bottom-right the counter.
- **Back**: the question in the header; under it a 2u `--rule-red` line at y = 48u, overshooting the text column by 8u on both sides; `--rule-blue` lines every 30u (at step 0) with the answer written on them (a `--rule-baseline` offset tuned once against a screenshot); the counter bottom-right.
- **Answer markup**:
  - each source line is a line on the card (the server turns line breaks into `<br>`, section 9);
  - gaps between blocks are defined by element pairs, each a whole number of ruled lines: one empty line between two paragraphs, and between a paragraph or list and a code block; none between a lead-in line and the list that follows it (the HTML cannot tell whether the source had a blank line there);
  - `- ` items get a hanging `--s-pink` en dash in the margin, `1. ` items pink numerals; no nesting;
  - bold is a highlighter band: `linear-gradient(transparent 18%, var(--hl) 18% 86%, transparent 86%)`, `box-decoration-break: clone`;
  - inline code: Radon on `--code-wash`, radius 3u, **`line-height: 0`** (otherwise each line with code grows by about 2 px and the writing drifts off the rules);
  - code blocks: Radon, line height = the rule pitch, a `--code-wash` band and a 2u pen bar on the left at 25 %, `white-space: pre`, never wrapped or scrolled (lines are limited to 46 characters);
  - `->` and `<-` are typeset as → and ← outside code (by the server).
  - An end-to-end check asserts every text line on the back sits on the rule grid.
- The hidden face is `inert` and `aria-hidden`; the card carries `data-side`.
- **Desk**: `--desk`, the `--desk-glow` radial ellipse behind the card and the same grain at 4 %, painted once.

## 8. Long answers

1. Validation caps the source (section 9).
2. The card is measured in `useLayoutEffect`, before paint, once `document.fonts.check()` passes for Shantell (if it doesn't yet, after `document.fonts.load()` resolves); until then the card's content is `visibility: hidden`, so a card that needs step 1 never shows a frame at step 0. The back is measured at step 0; if it overflows (vertically, or a code line wider than its column: `scrollWidth > clientWidth`), step 1, then step 2 (`data-fit="0|1|2"`). The front question goes through its own three steps.
3. Last resort: `data-fit="scroll"`, the body scrolls vertically with a bottom fade. The end-to-end fit test over the **real** deck fails the build if any card reaches it.

## 9. Data: `cards/cards.toml`

```toml
# flash deck. Edit, run `bun run cards:check`, ship with `scripts/deploy-do.sh cards`. Rules: docs/cards.md.
# Not carded (stubs in the source notes): "Scaling writes", "Webhooks".
topics = ["Patterns", "Case studies", "Sharding", "Real-time", "Edge", "Postgres", "SQL", "Queues", "Streams", "Redis", "Consistency", "Concurrency"]

# Corrected: notes line 129 say "LRU eviction by default"; redis.conf: maxmemory-policy noeviction (redis.io/docs/latest/develop/reference/eviction).
[[card]]
question = "What does Redis do by default when memory is full?"
topics = ["Redis"]
answer = '''
**Nothing is evicted.** The default policy is `noeviction`: once `maxmemory` is reached, writes fail with an OOM error; reads still work.
- On 64-bit, `maxmemory` defaults to 0 (no limit), so set one.
- For a cache, configure `allkeys-lru` (or `allkeys-lfu`).
'''
```

- Top level: exactly `topics` (1–30 unique labels, 1–20 characters each, `^[A-Za-z0-9][A-Za-z0-9 &+./-]*$`, no trailing space, each used by at least one card; declared order is panel order) and `card` (1–500 tables).
- `[[card]]`: exactly `question`, `topics`, `answer`; unknown keys fail (catches `topic =`).
- `question`: 8–100 characters after trimming, one line, inline markup only (`code`, `**bold**`), unique ignoring case.
- `topics`: 1–3 declared labels, no repeats.
- `answer`: 1–520 characters after trimming; at most 12 lines (blank and code lines count); code lines at most 46 characters; no tabs.
- Characters: only what the two fonts cover (Shantell's latin file and Radon); anything else fails, naming the character and its code point. The covered set is extracted once from the two font files (e.g. with fontTools through `uvx`) and committed as `shared/glyphs.ts`.
- **Id**: derived, `slug(question)` (lowercase ASCII, `-` separated, at most 64 characters); duplicates fail.
- **Markdown**: rendered by `Bun.markdown.html` (an unstable Bun API: pin Bun, test it) with `noHtmlBlocks: true`, `noHtmlSpans: true`, `noIndentedCodeBlocks: true`, `tables: false`, `tasklists: false`, `strikethrough: false`, `autolinks: false` (tables, strikethrough and task lists are on by default despite Bun's docs; `hardSoftBreaks` does nothing in 1.3.14). Then the renderer:
  - turns each `\n` inside `p` and `li` text (outside `pre`) into `<br>`, so each source line is a line on the card;
  - strips every attribute but `start` on `ol` (so `code` loses its `class="language-…"`);
  - typesets `-&gt;` and `&lt;-` (the escaped forms it receives) as → and ← in text outside `code` and `pre`.
- Allowed output in an answer: `p`, `br`, `ul`, `ol`, `li`, `strong`, `code`, `pre`, where `li` holds inline content only (no `p`, `pre` or list inside it: a loose list, with blank lines between items, fails); in a question: `code` and `strong` (the outer `p` removed). Anything else fails with the card and the reason: headings (including a setext `---` under a line), links, images, block quotes, rules, emphasis, a list inside a list. An unclosed fence is caught on the source (an odd number of fence lines). A literal HTML tag is not an error: it renders as escaped text, visibly.
- **Failing loudly**: every problem at once, one per line, naming the card: `card 12 "what-does-redis-do-by-default-when-memory-is-full": answer is 611 characters (max 520)`. TOML syntax errors with line and column. `bun run cards:check` exits 1; the server refuses to start with the same list.
- **Version**: the first 12 characters of the base64url SHA-256 of the canonical JSON of the deck. It is the ETag and what `/healthz` reports.
- **Wire shape** (`shared/types.ts`):

```ts
export type Card = { id: string; topics: string[]; questionHtml: string; answerHtml: string };
export type Deck = { version: string; topics: string[]; cards: Card[] };
```

- **Shipping a change**: edit (Claude Code or by hand) → `bun run cards:check` (under 1 s) → commit and push → `scripts/deploy-do.sh cards` (about 30 s: checks, runs the fit test on the real deck, rsyncs the one file, restarts, confirms `/healthz` reports the new version) → on the phone, close and reopen the app (the deck is fetched network-first).

## 10. Stack (exact pins; each at least 7 days old)

- Runtime: Bun pinned to the laptop's `bun --version` (1.3.14) on the droplet; Hono 4.13.13 with `@hono/bun` 1.0.1 for `serveStatic` (`hono/bun`'s is deprecated, to be removed in v5; Hono's static serving sends no ETag); Zod 4.6.7; smol-toml 1.9.1; React 19.3.1 and react-dom; TanStack Query 5.104.5; vite-plugin-pwa 2.0.0.
- Dev: TypeScript **7.0.2**; Vite 8.3.x; `@vitejs/plugin-react` 6.1.x; `@types/react`, `@types/react-dom` 19.3.x; `@types/bun` matching the runtime; Biome 2.6.x (`--error-on-warnings`, two spaces, double quotes).
- Test: Vitest 5.0.x; happy-dom 21.x; `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`; `@playwright/test` 1.64.x; `@axe-core/playwright` 4.14.x.
- `bunfig.toml`: `[install] minimumReleaseAge = 604800` and `exact = true`.
- Not used: openapi-typescript and openapi-fetch (TS 7, maintenance mode), a motion library, Tailwind, TanStack Router, React Aria, Zod in the client bundle (types only).

## 11. Architecture

```text
flash/
├── cards/cards.toml               the deck
├── shared/types.ts                wire types (M0)
├── shared/schema.ts               Zod schema of the TOML file, LIMITS
├── shared/glyphs.ts               the characters the two fonts cover (extracted once)
├── server/markdown.ts             Bun.markdown → allowlisted HTML; arrows
├── server/deck.ts                 TOML text → Deck; DeckError lists every problem
├── server/api.ts                  createApi(deck): Hono routes /api/cards, /healthz; type Api
├── server/app.ts                  createApp({ deck, distDir }): api + static + headers
├── server/main.ts                 Bun entry: env, load, serve
├── scripts/check-cards.ts         cards:check [--version]
├── scripts/budget.ts              size budgets over dist/
├── scripts/deploy-do.sh
├── src/main.tsx                   root, QueryClient, StrictMode
├── src/app/                       App.tsx, App.module.css, useShortcuts.ts
├── src/api/                       client.ts (hc<Api>), useDeckQuery.ts
├── src/deck/                      types.ts (M0), deck.ts, selection.ts, useDeck.ts
├── src/gesture/                   gesture.ts, useSwipe.ts
├── src/motion/                    timing.ts
├── src/stage/                     CardStage.tsx, stage.module.css
├── src/card/                      CardView.tsx, EndCard.tsx, MessageCard.tsx, fit.ts, card.module.css
├── src/panel/                     TopicPanel.tsx, colours.ts, panel.module.css
├── src/desk/                      Wordmark.tsx, desk.module.css
├── src/platform/                  fullscreen.ts, wakeLock.ts, haptics.ts, FullscreenChip.tsx
├── src/styles/                    tokens.css, fonts.css, global.css
├── src/fonts/                     the two woff2 files and their OFL texts
├── public/                        icon.svg and the generated PNG icons
├── tests/fixtures/cards.toml      the fixture deck
├── tests/e2e/                     specs, helpers.ts
├── tests/screenshots/             baselines
├── tests/conventions.test.ts      e.g. no expression-bodied effects
└── docs/                          original-request.md, plan.md, cards.md, seed.md
```

Every test sits beside its module (`x.test.ts`). Server and scripts run under `bun test` (they use `Bun.markdown` and `Bun.serve`); `src/` and `tests/conventions.test.ts` under Vitest with happy-dom; `bun run test` runs both.

Two tsconfigs: `tsconfig.json` (DOM: `src`, `shared`, `server/api.ts` by import, `tests/conventions.test.ts`; `vite/client` types) and `tsconfig.node.json` (Bun: `server`, `scripts`, `shared`, `tests/e2e`, the config files). `server/api.ts` imports nothing Bun-specific, so the client can import its type.

### Interfaces (frozen in M0; each package builds behind them)

```ts
// shared/schema.ts
export const LIMITS = { topics: 30, topicLabel: 20, cards: 500, id: 64, cardTopics: 3,
  questionMin: 8, questionMax: 100, answerMax: 520, answerLines: 12, codeLine: 46 } as const;
export const CardsFileSchema: z.ZodType<CardsFile>; // strict keys
export type CardsFile = { topics: string[]; card: { question: string; topics: string[]; answer: string }[] };
export const DeckSchema: z.ZodType<Deck>; // the wire shape, for the contract test

// server/markdown.ts
export function renderAnswer(src: string): { html: string } | { problems: string[] };
export function renderQuestion(src: string): { html: string } | { problems: string[] };

// server/deck.ts
export class DeckError extends Error { readonly problems: string[] }
export function slug(text: string): string;
export function loadDeck(toml: string): Deck; // parse, validate, render, version; throws DeckError

// server/api.ts: the return type is inferred from the chained routes, never annotated, so the routes' types reach the client
export function createApi(deck: Deck) /* new Hono().get("/api/cards", …).get("/healthz", …) */;
export type Api = ReturnType<typeof createApi>;

// server/app.ts
export function createApp(o: { deck: Deck; distDir: string }): Hono;

// src/api/client.ts, useDeckQuery.ts
export function createClient(base?: string, fetchImpl?: typeof fetch): ReturnType<typeof hc<Api>>;
export function fetchDeck(client?: ReturnType<typeof createClient>): Promise<Deck>; // throws on non-2xx
export function useDeckQuery(): UseQueryResult<Deck, Error>; // staleTime and gcTime Infinity, retry 2, no refetch on focus or reconnect

// src/deck/types.ts (M0, types only: the stage and the card build against these while the engine is built in parallel)
export type Rng = () => number; // [0, 1)
export type Side = "front" | "back";
export interface Pass { order: readonly string[]; index: number; side: Side } // index === order.length → end card
export interface DeckView {
  prev: Card | null; current: Card | "end"; next: Card | "end" | null;
  side: Side; position: number; total: number; // 1-based position; total = pass size
  selected: ReadonlySet<string>; topics: readonly string[];
  flip(): void; goNext(): void; goPrev(): void; reshuffle(): void; toggleTopic(label: string): void; clearTopics(): void;
}
// goNext() on the end card reshuffles; next() itself is a no-op there. clearTopics() empties the selection (= All).

// src/deck/deck.ts, selection.ts, useDeck.ts
export function poolFor(cards: readonly Card[], selected: ReadonlySet<string>): string[];
export function shuffle<T>(xs: readonly T[], rng: Rng): T[];
export function deal(pool: readonly string[], rng: Rng, o?: { keep?: string; avoidFirst?: string }): Pass;
export function flip(p: Pass): Pass;
export function next(p: Pass): Pass;
export function prev(p: Pass): Pass;
export function reshuffle(p: Pass, pool: readonly string[], rng: Rng): Pass;
export function reselect(p: Pass, pool: readonly string[], rng: Rng): Pass;
export function toggle(selected: ReadonlySet<string>, label: string): Set<string>;
export function loadSelection(s: Pick<Storage, "getItem"> | null, known: readonly string[]): Set<string>;
export function saveSelection(s: Pick<Storage, "setItem"> | null, selected: ReadonlySet<string>): void;
export function useDeck(deck: Deck, deps?: { rng?: Rng; storage?: Storage | null }): DeckView;

// src/gesture/gesture.ts, useSwipe.ts
export const GESTURE = { slop: 10, axisRatio: 1.2, tapMaxMs: 350, commitFraction: 0.28, flingVelocity: 0.45,
  flingMinDx: 24, velocityWindowMs: 80, tiltPerPx: 0.03, tiltMax: 7, rubberLimit: 80 } as const;
export interface Sample { t: number; x: number; y: number }
export function classify(start: Sample, now: Sample): "pending" | "horizontal" | "vertical";
export function isTap(start: Sample, end: Sample): boolean;
export function velocityX(samples: readonly Sample[]): number; // px/ms, least squares over the window
export function release(dx: number, vx: number, width: number, can: { prev: boolean; next: boolean }): "next" | "prev" | "cancel";
export function rubberBand(dx: number): number;
export interface SwipeOptions {
  layers(): { current: HTMLElement; next: HTMLElement | null; prev: HTMLElement | null } | null;
  can(): { prev: boolean; next: boolean };
  onTap(): void;
  onCommit(dir: "next" | "prev"): void; // after the animation finishes
  reducedMotion(): boolean;
  animate?: (el: Element, k: Keyframe[], o: KeyframeAnimationOptions) => Animation; // injectable
}
export function useSwipe(stage: RefObject<HTMLElement | null>, o: SwipeOptions): { commit(dir: "next" | "prev"): void };

// src/motion/timing.ts
export function flingDuration(remainingPx: number, vPxPerMs: number): number; // clamp(3.5·d/max(|v|,0.6), 180, 320)
export const MOTION: { commitEase: string; cancelMs: number; cancelEase: string; dealMs: number; dealEase: string; fadeMs: number };

// src/stage/CardStage.tsx, src/app/useShortcuts.ts
// The stage calls useShortcuts itself, so → and l animate exactly as a swipe does (through useSwipe's commit).
export interface CardStageProps { view: DeckView; renderCard(card: Card | "end", role: "prev" | "current" | "next"): ReactNode;
  onFullscreen(): void }
export function useShortcuts(h: { flip(): void; next(): void; prev(): void; reshuffle(): void; fullscreen(): void }): void;
// renderCard must key the card it returns by card id (or "end"), so a new card never inherits the last one's flip.

// src/card/*, src/panel/*, src/desk/*
export interface CardViewProps { card: Card; side: Side; position: number; total: number; colourOf(topic: string): string }
export interface EndCardProps { total: number }
export interface MessageCardProps { title: string; hint?: string; tone?: "pencil" | "error"; onTap?(): void } // loading, error, empty
export function chooseStep(fits: (step: number) => boolean, steps: number): number | "scroll";
export function useFit(ref: RefObject<HTMLElement | null>, steps: number, key: string): number | "scroll"; // awaits fonts.load
export interface TopicPanelProps { topics: readonly string[]; counts: ReadonlyMap<string, number>; total: number;
  selected: ReadonlySet<string>; onToggle(label: string): void; onAll(): void; colourOf(topic: string): string; lead?: ReactNode }
export function colourFor(index: number): string; // "var(--s-pink)" … cycles 8

// src/platform/*
export function canFullscreen(): boolean; // fullscreenEnabled && display-mode browser && !fullscreenElement
export function toggleFullscreen(): Promise<void>; // request + orientation lock, or exit; errors swallowed
export function useWakeLock(idleMs?: number): void; // default 300_000
export function tick(ms?: number): void; // vibrate(8) on coarse pointers only
export function FullscreenChip(): ReactNode; // null when not applicable
```

`CardStage` takes a render prop, so the stage never imports the card's components.

### DOM contract between the stage (P3) and the card (P4), outer to inner

- `stage` (P3): positions the layers, renders the blank cards peeking behind (it knows position and total), sets `data-flipping` while a flip runs and `data-state="idle|dragging|animating"`. Never clips.
- `layer[data-role="prev|current|next"]` (P3): one per role, absolutely positioned over the card box; the drag `translate`/`rotate` is written inline here and never transitioned. A layer not in play is `visibility: hidden; pointer-events: none`.
- `lift` (P3): the press scale (section 4), so the press never makes the dragged card trail the finger.
- `frame` (P4): the 5:3 box filling the layer; `container-type: size`; no visuals.
- `flipper` (P4): the flip transform and `data-side`; `transform-style: preserve-3d`; nothing that flattens it (section 4).
- `face` × 2 (P4): paper, radius, grain, the shadow (a pseudo-element whose opacity the press raises), the content. The back is pre-rotated. The hidden face is `inert` and `aria-hidden`.
- The card underneath hides its content while the stage has `data-flipping` (P4's CSS reacting to P3's attribute: `[data-flipping] [data-role="next"] .face > *`).

### Cross-package wiring

During M1 a package imports only M0's files and its own; it never imports another package's module (they don't exist on its branch). All cross-package wiring is M2's `App`: haptics on commit and on a chip toggle, `f` and the fullscreen chip (`toggleFullscreen`, passed to the stage as `onFullscreen` and to the panel as `lead`), the wake lock, `MessageCard` for loading, error and empty, the counts for the panel, the wordmark's place.

### Server behaviour

- `GET /api/cards`: the deck, `ETag: "<version>"`, `Cache-Control: no-cache`, 304 on a matching `If-None-Match`.
- `GET /healthz`: `{ ok: true, cards: 65, version }`, `Cache-Control: no-store`.
- Static from `dist/`: `/assets/*` `public, max-age=31536000, immutable`; `/`, `/index.html`, `/sw.js`, `/registerSW.js`, `/workbox-*.js`, `/manifest.webmanifest` and icons `no-cache`. `/` serves `index.html`. Anything else 404. `HEAD` answers like `GET`.
- Every response: `X-Robots-Tag: noindex, nofollow`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- Compression is Caddy's.
- Env: `PORT` (3000), `HOST` (0.0.0.0), `CARDS` (`cards/cards.toml`), `DIST` (`dist`).
- Build: `vite build && bun build server/main.ts --target=bun --minify --outfile build/server.js`; the droplet gets `server.js`, `dist/` and `cards/cards.toml`, no `node_modules`.

### Scripts (`package.json`)

- `dev`: Vite, proxying `/api` and `/healthz` to :3000. `serve`: `bun --watch server/main.ts`.
- `build`, `start` (`bun build/server.js`).
- `test`: `vitest run && bun test server scripts`. `e2e`: `playwright test`.
- `typecheck`: `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit`. `lint`: `biome check --error-on-warnings .`.
- `cards:check`, `budget`.
- `verify`: `cards:check → typecheck → lint → test → build → budget → e2e`.

## 12. Testing (strict Beck-style TDD)

A failing test first, the simplest change to green, refactor at green, commit at green. Type declarations, configuration and pure wiring are not behaviour and need no test. Tests own behaviour, not implementation.

- **Unit** (`bun test` for `server/` and `scripts/`, Vitest for `src/`): schema and file rules, Markdown allowlist, deck loading, HTTP handlers via `app.request()`, deck engine, selection, gesture maths, timing, colours, fit chooser, budget script.
- **Component** (Vitest, happy-dom, Testing Library, rendered in `<StrictMode>`): TopicPanel, CardView, EndCard, MessageCard, FullscreenChip, CardStage with `useSwipe` (synthetic `PointerEvent`s with explicit `clientX` and `timeStamp`, an injected `animate` that records keyframes and exposes `finish()`), App with an injected fetch. A `<Profiler>` asserts **zero React commits during a drag**.
  - happy-dom 21.0.4 gaps, verified: no `document.fonts` and no `document.getAnimations`; `(pointer: coarse)` is false; `fullscreenEnabled`, `navigator.vibrate` and `navigator.wakeLock` are undefined; `PointerEvent` ignores `timeStamp` in its init (set it with `Object.defineProperty(e, "timeStamp", { value })`, which survives dispatch); no layout. Inject or stub these; everything visual and timing-real is Playwright's.
- **Conventions** (`tests/conventions.test.ts`, Vitest): reads the sources with `import.meta.glob("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true })` and regexes; never imports `typescript` (TypeScript 7's package exports no compiler API).
- **Contract**: `server/api.test.ts` parses the `/api/cards` body against the wire types' Zod mirror; the client compiles against `Api` (the typecheck); the e2e tests render the real server's response through the real client.
- **End to end** (Playwright 1.64 Chromium against `build/server.js` serving `dist/`, via `webServer`): two servers, port 4173 with `tests/fixtures/cards.toml` (deterministic flows and screenshots) and port 4174 with `cards/cards.toml` (the fit test).
  - Projects: `pixel11` (viewport and screen 923 × 412, `deviceScaleFactor` 2.625, `isMobile`, `hasTouch`, a Chrome Android user agent, `en-GB`); `portrait` (412 × 923); `laptop` (1280 × 800, fine pointer).
  - Determinism: a seeded `Math.random` (mulberry32, seed 42) via `page.addInitScript`; swipes through CDP `Input.dispatchTouchEvent` (a `swipe(page, { from, to, ms })` helper sending a move every 8 ms with explicit timestamps); `settled()` waits for `document.getAnimations().length === 0`; the app sets `performance.mark("flash:first-card")` after `document.fonts.load()`, and screenshots wait for it.
  - Specs: reading (first card, tap flips, swipe left next, swipe right previous, cancel, a fling against the drag cancels, rapid flicks, end card and reshuffle), topics (toggle, OR, All, persistence across a reload, the card on screen survives, every seed chip visible without scrolling on the real deck), keyboard, fit (every real card fits without scrolling; every text line on the back sits on the rule grid), layout (no sideways scroll on every project; every visible control at least 44 × 44 under a coarse pointer, skipping the visually hidden buttons; the card at least 48 px from the right edge; a 40 px camera inset through CDP `Emulation.setSafeAreaInsetsOverride`, never a test-only CSS variable), accessibility, performance, PWA (manifest fields, precache, a single deck request thanks to the preload; offline: load, wait for `navigator.serviceWorker.controller`, reload online, then go offline and reload: a card shows), screens.
  - The fullscreen chip shows on every Playwright page (they are `display-mode: browser` with fullscreen enabled, and CDP cannot emulate the display mode). A tap-triggered `requestFullscreen` does switch headless Chromium to `display-mode: fullscreen`, so every `pixel11` screenshot and layout check except "the fullscreen chip in a tab" presses `f` first.
- **Visual** (`toHaveScreenshot`, `animations: "disabled"`, `caret: "hide"`, `maxDiffPixelRatio: 0.001`), on `pixel11` unless named: front; back with a list and inline code; back with a code block; back at fit step 2; end card; loading; error; three topics selected; `portrait` front; `laptop` back; the fullscreen chip in a tab; a 40 px camera inset.
- **Accessibility**: axe (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`) reports nothing on the front, the back, the end card, loading, error and a selection; a keyboard-only reading flow; visible focus; the counter `aria-live="polite"`; under reduced motion only opacity animates.
- **Budgets** (`scripts/budget.ts` after the build; `perf.spec.ts` with CDP 4× CPU throttling):
  - initial JS ≤ 100 kB gzipped; CSS ≤ 12 kB gzipped; fonts ≤ 240 kB; precache ≤ 700 kB raw;
  - first card cold (no service worker, cache off, 4× CPU, 40 ms RTT, 10 Mbit/s) ≤ 1,200 ms to `flash:first-card`; warm and offline ≤ 350 ms;
  - every Event Timing entry (tap to flip, key to next) ≤ 48 ms at 4× CPU, measured with `PerformanceObserver({ type: "event", durationThreshold: 16, buffered: true })`, not a trace (traces inflate DOM-churn timings);
  - no long animation frame (> 50 ms) during a flip or a swipe;
  - every running animation touches only `transform` and `opacity` (`document.getAnimations()` sampled).
- `tests/conventions.test.ts` fails on an expression-bodied `useEffect` or `useLayoutEffect` (`useEffect(() => el.scrollTo(…))` returns a Promise in current Chrome that React calls as cleanup, and the app blanks).

### The first ten tests

1. `tests/e2e/reading.spec.ts` › on a Pixel 11 in landscape the first card's question shows; a tap reveals its answer; a left swipe deals the next card (the outer loop; red until integration).
2. `server/deck.test.ts` › `loadDeck` turns a minimal TOML deck into its declared topics and cards, ids slugged from the questions.
3. `server/deck.test.ts` › `loadDeck` reports every problem at once, naming the card: undeclared topic, duplicate question, question over 100 characters, unknown key.
4. `server/markdown.test.ts` › `renderAnswer` renders hard-broken lines, `-` and `1.` lists, fenced code, inline code and bold; rejects a heading and a link, each with its reason.
5. `server/api.test.ts` › `GET /healthz` answers 200 with `ok`, the card count and the version.
6. `server/api.test.ts` › `GET /api/cards` returns the deck with its ETag and `no-cache`, and 304 for a matching `If-None-Match`.
7. `src/deck/deck.test.ts` › `deal()` with a seeded `Rng` is a deterministic permutation of the pool; `poolFor()` is OR across topics and every card for an empty selection.
8. `src/deck/deck.test.ts` › `next()` past the last card gives the end card; `reshuffle()` never starts the new pass with the card just seen.
9. `src/gesture/gesture.test.ts` › `release()` commits next beyond 28 % of the width or faster than 0.45 px/ms leftwards, previous mirrored only when a previous card exists, otherwise cancels.
10. `src/panel/TopicPanel.test.tsx` › All is pressed when nothing is selected; chips keep the declared order and carry `aria-pressed`; their accessible names include counts.

## 13. Deployment: `scripts/deploy-do.sh`

Adapted from `~/github/plant-selection/scripts/deploy-do.sh`.

- `NAME=flash`, `REGION=fra1`, `SIZE=s-1vcpu-512mb-10gb`, `IMAGE=ubuntu-24-04-x64`, `SSH_KEY` (from the environment), `APP=/opt/flash`, `DOMAIN=flash.patforna.com` (A record, TTL 300, through the existing `record`/`dns` functions), service `flash.service` running as user `app`, tag `web-app`, `--enable-monitoring`.
- Removed from the reference: the `KEY` env file and `?key=` link, `backup` (nothing on the droplet is unique), the bare-IP Caddy block.
- Subcommands: `up`, `cards`, `link` (prints `https://flash.patforna.com/`), `logs`, `down` (deletes the droplet and its A record).
- **Gate**: `up` runs `bun install --frozen-lockfile && bun run verify` before touching the droplet. No flag skips it.
- **Provisioning**: idempotent as in the reference, plus Bun pinned to the laptop's version (`curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash -s "bun-v$BUN_VERSION"` unless already that version).
- Service: `Environment=HOST=127.0.0.1 PORT=3000 CARDS=/opt/flash/app/cards/cards.toml DIST=/opt/flash/app/dist`, `ExecStart=/usr/local/bin/bun server.js`, `Restart=always`.
- Caddy, multi-line (Caddy cannot parse a one-line block): `flash.patforna.com {` / `encode zstd gzip` / `reverse_proxy 127.0.0.1:3000` / `}`.
- **Sync**: stage the droplet's layout in `build/release/` (`server.js`, `dist/`, `cards/cards.toml`) and send it with one `rsync -az --delete`; then `chown`, `daemon-reload`, `enable`, `restart flash`, `reload caddy`.
- **Health**: on the droplet, curl `127.0.0.1:3000/healthz` up to 15 times a second apart, else print `journalctl -u flash -n 30` and exit 1; then from the laptop `https://flash.patforna.com/healthz`, whose `version` must equal `bun scripts/check-cards.ts --version cards/cards.toml` (on a new droplet, retried for up to 2 minutes while DNS and the certificate come up); then print the link.
- **`cards`**: `bun run cards:check` → the fit spec against the real deck (building first if `dist/` or `build/` is missing) → rsync the one file → `systemctl restart flash` → the same health check. Never ships code.
- **Indexing**: `X-Robots-Tag` and the meta tag; no robots.txt. The hostname is public through Certificate Transparency logs the moment Caddy gets its certificate: never put private material in cards.
- **Records**: `gh repo create patforna/flash --private --source . --push`; a row in the "Web apps" table of `~/github/system/README.md` (`flash.patforna.com`, `~/github/flash`, `flash`), committed and pushed there.

## 14. Documentation

- `README.md` (Patric): what it is and the link; installing on the phone (Chrome ⋮ → Install); reading (tap, swipe, keys, topics); developing, testing and deploying; layout; an aligned env table.
- `CLAUDE.md` (future agents): purpose and constraints (reading only, landscape first, KISS/YAGNI, British English, no dead code); every decision here with its one-line reason; conventions (strict TDD; braced effect bodies; `document.fonts.load()`; 44 px; no sideways scroll; transform and opacity only; no React state during drags; the 48 px edge strip); where things are; shipping cards versus code; gotchas (Bun's TOML parser; openapi-typescript and TS 7; the Android back gesture; the hostname is public; Caddy's one-line blocks; the service-worker kill switch); current state.
- `docs/cards.md` (Patric, and Claude Code editing cards): the format with a complete example; every rule and limit; the markup with examples; how to write a good card; the topic list and how to add or rename one; the check and ship commands; a link to `docs/seed.md`.
- `docs/seed.md`: how the seed was made from the notes; the stubs not carded; the corrections log (notes line, what it said, what the card says, the source).
- `docs/original-request.md`: verbatim, later clarifications appended with dates. `docs/plan.md`: this file, frozen.

## 15. Seed cards

- Scope: all 157 lines of the source notes.
- One idea per card: what you could answer aloud in 20–40 s. Two facts share a card when one explains the other.
- About 65 cards across the 13 topics declared above (Patterns, Case studies, Sharding, Real-time, Edge, Postgres, SQL, Queues, Streams, Redis, Consistency, Concurrency); merge or split within ±5.
- Questions: what you would be asked (What, Why, How, When, "Walk through", "Sketch"), never a bare noun; 40–80 characters, at most 100.
- Answers: the gist first in one line, then up to 4 bullets; highlight at most one or two key facts; 150–350 characters, at most 520 and 12 lines; code lines at most 46; tight lists only (no blank lines between items); numbers with units; British spelling; self-contained.
- Stubs ("Scaling writes: ...", "Webhooks"): no cards; named in the comment at the top of the file.
- Wrong statements: corrected on the card, with a `# Corrected:` comment above it citing the notes' line and a primary source; listed in `docs/seed.md` and in the hand-off email. Additions beyond the notes only where an answer would otherwise be wrong or not self-contained, marked `# Added:` with a source.
- The fact-check of the notes (eleven wrong or misleading statements, and the nuances) is the input; every card is then reviewed against the notes and against the primary sources for the corrected claims.

## 16. Work breakdown

One agent per package, each in its own git worktree on a branch `pkg/<id>`, committing at every green. Each file has exactly one owner. `package.json`, `bun.lock` and the configs belong to M0 and then integration; a package that needs a dependency asks, it does not add one.

- **M0 Scaffold** (one agent): the pinned `package.json` and `bunfig.toml`, both tsconfigs, `biome.json`, `vitest.config.ts`, `playwright.config.ts` (projects, two web servers), `vite.config.ts` (React, the PWA block, the proxy), `index.html`, the type-only files `shared/types.ts` and `src/deck/types.ts`, `src/styles/tokens.css`, the fonts and `fonts.css`, the fixture deck, `.gitignore`, CLAUDE.md v1 with the ownership map. Commit on `main`. Done: `306506a`, then `d4bbca4` (font stacks, `workbox-window` dropped).
- During M1 a package imports only M0's files and its own (section 11, "Cross-package wiring").
- **M1, in parallel**:
  - **P1 Server and data**: `shared/schema.ts`, `shared/glyphs.ts`, `server/*`, `scripts/check-cards.ts`, `src/api/*`.
  - **P2 Deck engine**: `src/deck/*`.
  - **P3 Stage and gestures**: `src/gesture/*`, `src/motion/*`, `src/stage/*`, `src/app/useShortcuts.ts`.
  - **P4 Look and feel**: `src/styles/global.css`, `src/card/*`, `src/panel/*`, `src/desk/*`, `public/icon.svg` and the PNG icons generated from it.
  - **P5 Platform and PWA**: `src/platform/*`, `tests/e2e/pwa.spec.ts` (self-contained; red until integration).
  - **P6 Seed cards**: `cards/cards.toml` and `docs/seed.md` (scope, stubs not carded, the corrections log), then reviewed by two independent checkers (fidelity to the notes; correctness against primary sources). P1's `cards:check` doesn't exist on P6's branch, so P6 checks every rule with a throwaway script; M2 runs `cards:check` and the fit test on the real deck and fixes what they find.
  - **P7 Ops and docs**: `scripts/deploy-do.sh`, `scripts/budget.ts`, `README.md`, `docs/cards.md`.
- **M2 Integration**: merge the branches in order (P1, P2, P3, P4, P5, P6, P7) with `--no-ff`; `src/main.tsx`, `src/app/App.tsx` and its test, every e2e spec but `pwa.spec.ts`, the baselines, `tests/conventions.test.ts`; `verify` green on `main`.
- **M3 Review**: code review and a design review of the whole thing against this plan and the original request, the design review on screenshots of the Pixel 11 project and iterated until it finds nothing worth changing; fixes; `verify` green.
- **M4 Ship**: `deploy-do.sh up`; a smoke run of the reading flow, axe and the cold first card against `https://flash.patforna.com` on the Pixel 11 project; the private GitHub repo; the system README row; an email to Patric with the link, install steps, the corrections and an on-phone checklist.

## 17. Risks

- **Jank** (fails the first requirement): compositor-only motion, no renders during drags, Long Animation Frames, Event Timing and the zero-commit test all asserted.
- **The Android back gesture eats a swipe**: the 48 px strip, drags only from the card, a layout test on the gap.
- **Overflowing answers**: validation, fit steps, the fit test in both the gate and the cards path.
- **Fonts flash or measure wrong**: preload, `font-display: block` for Shantell, `document.fonts.load()` before measuring and before `flash:first-card`.
- **A stale service worker**: `autoUpdate`, `skipWaiting`, `index.html` no-cache, the deck network-first, the kill switch documented.
- **Bun drift between laptop and droplet**: the droplet installs exactly the local version.
- **Parallel agents collide**: one owner per file, interfaces frozen in M0, worktrees, merges in order, dependencies pinned up front.
- **happy-dom gaps** (no layout, partial WAAPI and pointer capture): injected `animate`, measurement and clock; everything visual covered in Playwright.
- **Emulation is not the phone** (120 Hz, haptics, the back gesture, wake lock): the hand-off's on-phone checklist.
- **The URL is public**: noindex, non-private content, said in CLAUDE.md and the hand-off.

## 18. Out of scope (YAGNI)

Spaced repetition, grading, progress, history, streaks; hiding, starring, favourites; remembering the position between launches; editing or creating cards in the app, any write API, uploads, more than one deck file; auth, keys, accounts, multi-tenancy, sharing links; AND or any/all switches, excluding topics, solo-a-topic, topic search, nested topics, per-topic colours in the data, counts on chips; images, audio, maths, tables, links, headings, italics, nested lists, syntax highlighting; swipe up or down to flip, tap zones, trackpad swipes, sound, physics beyond the eased curves; a light theme or switcher, a settings screen, a haptics toggle, deep links, URL state, a router, i18n; a custom install prompt, push, background sync; a first-run hint; CSP and hardening beyond the headers above, rate limiting, analytics, error reporting, CI pipelines (the gate runs in `deploy-do.sh`), a CDN or more than one droplet.
