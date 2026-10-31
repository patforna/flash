# flash

Flash cards for studying on a Pixel 11 held sideways: a hand-written index card on a dark desk, alone in fullscreen, topic stickers beside it in a browser tab. Tap the card to turn it over; swipe it away for the next one. The app only reads: the deck is `cards/cards.toml`, edited here and shipped with one command.

**https://flash.patforna.com**

## Installing it on the phone

1. Open https://flash.patforna.com in Chrome.
2. ⋮ → **Install**. Not "Create shortcut": that only opens it in a tab.
3. Start it from the home screen: fullscreen, in landscape.

Once it has opened twice with a connection, it works offline: the first launch installs the app, the second keeps the deck on the phone. In a browser tab, the corner-brackets sticker at the top of the panel goes fullscreen, and the same sticker, top left, comes back out.

## Reading

- **Tap** the card to turn it over, and again to turn it back.
- **Swipe left** for the next card, from either side, so a card can be skipped unread.
- **Swipe right** for the previous one. Every card you land on shows its question first.
- Each pass is a fresh shuffle with no repeats. After the last card, tap or swipe left to shuffle again.
- **Topics**: in a browser tab, tap stickers to narrow the deck; a card shows if it has any selected topic. **All** clears the selection. The selection survives closing the app; the place in the pass doesn't. Fullscreen, and so the installed app, shows the cards alone: how topics are chosen there is still being designed, so the installed app reads the whole deck for now.
- The screen stays on while you read, until 5 minutes without a touch.

With a keyboard:

| Key                          | Does                   |
|------------------------------|------------------------|
| Space, Enter, ↑, ↓, `j`, `k` | turn the card over     |
| →, `l`, Page Down            | next card              |
| ←, `h`, Page Up              | previous card          |
| `s`                          | shuffle again          |
| `f`                          | fullscreen, on and off |

## Cards

`docs/cards.md` has the format, the rules and how to write a good card. In short: edit `cards/cards.toml`, run `bun run cards:check`, commit and push, run `scripts/deploy-do.sh cards`, then close and reopen the app on the phone. The address is public, so nothing private goes on a card.

## Developing

Needs Bun 1.3.14, shellcheck and Playwright's Chromium (`bunx playwright install chromium`, once).

```sh
bun install
bun run serve   # the server on :3000, restarting when its code changes
bun run dev     # Vite on :5173, passing /api and /healthz to :3000
```

Run both and open http://localhost:5173. The server reads the deck when it starts: restart `bun run serve` after changing `cards/cards.toml`.

## Testing

| Command          | Runs                                                                                                     |
|------------------|----------------------------------------------------------------------------------------------------------|
| `bun run test`   | the unit and component tests: Vitest for `src/`, then `bun test` for `server/`, `scripts/` and `shared/` |
| `bun run e2e`    | Playwright, headless: a Pixel 11 in landscape, in portrait, and a laptop; `bun run build` first          |
| `bun run verify` | every gate in order: `cards:check`, `typecheck`, `lint`, `test`, `build`, `budget`, `e2e`                |

Each step of `verify` also runs alone, as `bun run <step>`; `budget` checks the size budgets over `dist/`. `bunx biome check --write .` fixes formatting and import order.

## Deploying

One droplet on DigitalOcean (`flash`, fra1), Bun behind Caddy, like the other apps (`~/github/system` README, "Web apps").

```sh
scripts/deploy-do.sh up      # verify, then create the droplet if needed, provision, upload, check it's healthy
scripts/deploy-do.sh cards   # the deck alone: check, fit test on the droplet's code, upload, restart, check; never code
scripts/deploy-do.sh link    # print https://flash.patforna.com/
scripts/deploy-do.sh logs    # the server's log
scripts/deploy-do.sh down    # delete the droplet and its DNS record
```

`up` touches nothing on DigitalOcean unless `bun install --frozen-lockfile` and `bun run verify` pass; no flag skips them. It needs `doctl`, logged in, and an SSH key registered with DigitalOcean (`SSH_KEY` is its id).

On the phone, a card change shows the next time the app starts, a code change the time after: the new version installs in the background.

## Layout

```text
cards/cards.toml   the deck
shared/            the wire types, the deck file's schema and limits, the characters the fonts cover
server/            Markdown rendering, loading and checking the deck, the API, the Bun entry point
src/               the app: deck engine, gestures and motion, stage, card, topic panel, platform
scripts/           cards:check, the size budgets, the deploy script
tests/             the fixture deck, the Playwright specs and their screenshots, the conventions test
docs/              the original request, the plan, the card guide, how the seed deck was made
```

## Environment

The server reads:

| Variable | Default            | Is                        |
|----------|--------------------|---------------------------|
| `PORT`   | `3000`             | the port it listens on    |
| `HOST`   | `0.0.0.0`          | the address it listens on |
| `CARDS`  | `cards/cards.toml` | the deck                  |
| `DIST`   | `dist`             | the built app it serves   |
