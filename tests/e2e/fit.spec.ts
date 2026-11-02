import type { Locator, Page } from "@playwright/test";
import type { Deck } from "../../shared/types";
import {
  announcer,
  expect,
  FIXTURE_URL,
  finger,
  firstCard,
  flipper,
  openTopics,
  REAL_DECK_URL,
  settled,
  test,
} from "./helpers";

// The real deck fits the screen. Long answers (docs/plan.md §7 and §8): every card fits both its faces without the
// last resort (data-fit="scroll"), and every line written on a back sits on a rule. Topics (§3): every row of the
// topic list is in full view in the drawer, or, when the topics outgrow it, scrolls into it. scripts/deploy-do.sh
// runs this file by name before it ships a deck.
//
// Under reduced motion the faces lie flat, unturned (the back fades in over the front), so both are measured in place
// without turning the card: the layout is the same either way.

test.use({ baseURL: REAL_DECK_URL, reducedMotion: "reduce" });

test.beforeEach(() => {
  test.skip(test.info().project.name !== "pixel11", "the Pixel 11 sizes the card");
});

interface Report {
  problems: string[];
  fits: [string, string];
  // How far each line of the answer sits from its rule, in px (positive: below it).
  offsets: number[];
}

// Runs in the page, on the card on top's flipper: the faces' fit steps, then where each line of the answer sits
// against the rules. A zero-size inline-block sits on its line's baseline, so one goes before every word; the rules
// are drawn by the answer's background, the first at --rule-baseline below its top, then one every line height.
function measure(flipper: Element): Report {
  const [front, back] = Array.from(flipper.children) as HTMLElement[];
  if (!front || !back) throw new Error("a card has two faces");
  const card = JSON.stringify(front.querySelector("h2")?.textContent ?? "");
  const problems: string[] = [];
  for (const [face, side] of [
    [front, "front"],
    [back, "back"],
  ] as const) {
    const fit = face.dataset.fit;
    if (fit !== "0" && fit !== "1" && fit !== "2") problems.push(`${card}: the ${side} is at data-fit="${fit}"`);
  }

  const answer = back.querySelector<HTMLElement>(":scope > div");
  if (!answer) throw new Error("a back holds its answer");
  // A back with pages isn't measured (it scrolls down), so nothing else checks it across: a part wider than the column
  // would be cut off, and a sideways scroller fights the swipe. A highlight's 2 units of end padding may hang past.
  if (back.dataset.pages && answer.scrollWidth > answer.clientWidth + Math.ceil((2 * back.clientHeight) / 360)) {
    problems.push(`${card}: the back is ${answer.scrollWidth} px wide, over its ${answer.clientWidth} px column`);
  }
  const rule = document.createElement("div");
  rule.style.cssText = "position: absolute; top: calc(var(--rule-baseline) * var(--u)); height: 0; margin: 0";
  answer.append(rule);
  const firstRule = rule.getBoundingClientRect().top;
  rule.remove();
  const pitch = Number.parseFloat(getComputedStyle(answer).lineHeight);
  // The plan's ruling: the red rule at 48 of the card's 360 units, the first blue one a line below it.
  const unit = back.getBoundingClientRect().height / 360;
  const planned = back.getBoundingClientRect().top + 48 * unit + pitch;
  if (Math.abs(firstRule - planned) > 1) {
    problems.push(`${card}: the first rule is at ${firstRule.toFixed(1)} px, not ${planned.toFixed(1)}`);
  }

  const probes: HTMLElement[] = [];
  const walker = document.createTreeWalker(answer, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  // A code block is a typed slip taped onto the card: its lines aren't written on the rules.
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (!text.parentElement?.closest("pre")) texts.push(text);
  }
  for (const text of texts) {
    const starts = Array.from(text.data.matchAll(/\S+/g), (m) => m.index);
    for (const start of starts.reverse()) {
      const probe = document.createElement("span");
      probe.style.cssText = "display: inline-block; width: 0; height: 0; margin: 0; padding: 0; border: 0";
      text.splitText(start).before(probe);
      probes.push(probe);
    }
  }
  const baselines = [...new Set(probes.map((probe) => Math.round(probe.getBoundingClientRect().top * 100) / 100))];
  for (const probe of probes) probe.remove();
  answer.normalize();

  const offsets: number[] = [];
  for (const baseline of baselines.sort((a, b) => a - b)) {
    const line = Math.round((baseline - firstRule) / pitch);
    const off = baseline - (firstRule + line * pitch);
    offsets.push(off);
    if (line < 0 || Math.abs(off) > 1) {
      problems.push(`${card}: the line at ${baseline.toFixed(1)} px is ${off.toFixed(1)} px off rule ${line + 1}`);
    }
  }
  return { problems, fits: [front.dataset.fit ?? "", back.dataset.fit ?? ""], offsets };
}

// Walks the whole pass with l, measuring the card on top each time; every problem at once.
async function walk(page: Page): Promise<{ problems: string[]; fits: [string, string][]; offsets: number[][] }> {
  await page.goto("/");
  await firstCard(page);
  const total = Number(/^Card 1 of (\d+)$/.exec((await announcer(page).textContent()) ?? "")?.[1]);
  expect(total).toBeGreaterThan(0);
  const problems: string[] = [];
  const fits: [string, string][] = [];
  const offsets: number[][] = [];
  for (let position = 1; position <= total; position++) {
    await expect(announcer(page)).toHaveText(`Card ${position} of ${total}`);
    await settled(page);
    const report = await flipper(page).evaluate(measure);
    problems.push(...report.problems);
    fits.push(report.fits);
    offsets.push(report.offsets);
    await page.keyboard.press("l");
  }
  await expect(announcer(page)).toHaveText(`That’s all ${total}. Tap or swipe to shuffle again.`);
  return { problems, fits, offsets };
}

// For the report: how many faces took each step, and how far the lines sit from their rules at each.
function annotate({ fits, offsets }: Awaited<ReturnType<typeof walk>>) {
  const tally = (side: 0 | 1) =>
    Object.entries(Object.groupBy(fits, (f) => f[side]))
      .map(([step, of]) => `${of?.length} at step ${step}`)
      .join(", ");
  const spread = Object.entries(Object.groupBy(offsets.entries(), ([i]) => fits[i]?.[1] ?? ""))
    .map(([step, cards]) => {
      const all = (cards ?? []).flatMap(([, off]) => off);
      return `step ${step} ${Math.min(...all).toFixed(2)} to ${Math.max(...all).toFixed(2)} px`;
    })
    .join(", ");
  test
    .info()
    .annotations.push(
      { type: "fits", description: `fronts: ${tally(0)}; backs: ${tally(1)}` },
      { type: "lines off their rules", description: spread },
    );
}

test("every card of the real deck fits both faces without scrolling, each line of its answer on a rule", async ({
  page,
}) => {
  const walked = await walk(page);
  annotate(walked);
  expect(walked.problems).toEqual([]);
});

test.describe("the fixture deck, which uses every kind of markup", () => {
  test.use({ baseURL: FIXTURE_URL });

  test("every line sits on a rule at every fit step, code included", async ({ page }) => {
    const walked = await walk(page);
    annotate(walked);
    expect(walked.problems).toEqual([]);
    // Its 11-line answer needs the smallest step.
    expect(walked.fits.map((f) => f[1])).toContain("2");
  });
});

// Every row of the topic list in full view in the drawer, or, when the topics outgrow it, scrolled into it: none under
// the list's fade, which shows only while there is more below, and nothing to scroll. Outgrown: the list scrolls, its
// foot fading at the top of the scroll, and a thumb scrolling it to the end brings the last row into full view, the
// fade gone. At the installed app's 412 px, and in a tab under Chrome's toolbars (356 and 332 px).
test.describe("the real deck's topics", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await firstCard(page);
    await settled(page);
  });

  // How far up from the list's foot its fade reaches, in px: where its mask turns opaque.
  const fade = (list: Locator) =>
    list.evaluate((el) => Number(/([\d.]+)px\)$/.exec(getComputedStyle(el).maskImage)?.[1] ?? 0));

  async function inFullView(page: Page) {
    const drawer = page.getByRole("dialog", { name: "Topics" });
    const list = drawer.locator(":scope > div").first();
    const rows = drawer.getByRole("button");
    // Whatever the deck being shipped holds: All, then a row for each of its topics.
    const { topics }: Deck = await (await page.request.get("/api/cards")).json();
    await expect(rows).toHaveCount(topics.length + 1);
    const box = await list.boundingBox();
    if (!box) throw new Error("no list");
    // Inside the list and clear of its fade as it is drawn now.
    const whole = async (row: Locator) => {
      const b = await row.boundingBox();
      const name = (await row.getAttribute("aria-label")) ?? "";
      if (!b) throw new Error(`${name} has no box`);
      const foot = box.y + box.height - (await fade(list));
      expect(b.y, `${name} starts above the list`).toBeGreaterThanOrEqual(box.y - 0.5);
      expect(b.y + b.height, `${name} ends under the list's fade`).toBeLessThanOrEqual(foot + 0.5);
    };
    if (await list.evaluate((el) => el.scrollHeight <= el.clientHeight)) {
      await expect.poll(() => fade(list), "no fade with nothing to scroll").toBe(0);
      for (const row of await rows.all()) await whole(row);
      return;
    }
    await expect.poll(() => fade(list), "the foot fades at the top of the scroll").toBe(24);
    const thumb = await finger(page, { x: box.x + box.width / 2, y: box.y + box.height - 20 });
    await thumb.move({ x: box.x + box.width / 2, y: box.y + 20 }, 300);
    await thumb.up();
    await expect.poll(() => list.evaluate((el) => el.scrollTop), "the list scrolls under a thumb").toBeGreaterThan(0);
    await list.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect.poll(() => fade(list), "no fade at the end of the scroll").toBe(0);
    await whole(rows.last());
  }

  for (const height of [412, 356, 332]) {
    test(`at 923 × ${height} every row is in full view, or scrolls into it`, async ({ page }) => {
      await page.setViewportSize({ width: 923, height });
      await settled(page);
      await openTopics(page);
      await inFullView(page);
    });
  }
});
