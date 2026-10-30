import type { Page } from "@playwright/test";
import { announcer, expect, firstCard, flipper, insets, settled, test } from "./helpers";

// The real deck fits the screen. Long answers (docs/plan.md §7 and §8): every card fits both its faces without the
// last resort (data-fit="scroll"), and every line written on a back sits on a rule. Topics (§3): every chip is in full
// view in the panel. scripts/deploy-do.sh runs this file by name before it ships a deck.
//
// Under reduced motion the faces lie flat, unturned (the back fades in over the front), so both are measured in place
// without turning the card: the layout is the same either way.

test.use({ baseURL: "http://127.0.0.1:4174", reducedMotion: "reduce" });

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
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
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
  await expect(announcer(page)).toHaveText(`That's all ${total}. Tap or swipe to shuffle again.`);
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
  test.use({ baseURL: "http://127.0.0.1:4173" });

  test("every line sits on a rule at every fit step, code included", async ({ page }) => {
    const walked = await walk(page);
    annotate(walked);
    expect(walked.problems).toEqual([]);
    // Its 11-line answer needs the smallest step.
    expect(walked.fits.map((f) => f[1])).toContain("2");
  });
});

// Every chip in full view, none under the panel's fade, nothing to scroll. In a tab, so the fullscreen chip leads: the
// fullest panel, with All and the 13 topics after it.
test.describe("the real deck's topics", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await firstCard(page);
    await settled(page);
  });

  async function inFullView(page: Page) {
    const panel = page.getByRole("group", { name: "Topics" });
    const chips = panel.getByRole("button");
    await expect(chips).toHaveCount(15);
    expect(await panel.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
    const box = await panel.boundingBox();
    if (!box) throw new Error("no panel");
    const fade = 24;
    for (const chip of await chips.all()) {
      const b = await chip.boundingBox();
      const name = (await chip.getAttribute("aria-label")) ?? "";
      if (!b) throw new Error(`${name} has no box`);
      expect(b.x, name).toBeGreaterThanOrEqual(box.x);
      expect(b.y, name).toBeGreaterThanOrEqual(box.y);
      expect(b.x + b.width, name).toBeLessThanOrEqual(box.x + box.width);
      expect(b.y + b.height, `${name} clear of the fade`).toBeLessThanOrEqual(box.y + box.height - fade);
    }
  }

  test("at 923 × 412 every chip is in full view, none under the panel's fade, nothing to scroll", async ({ page }) => {
    await inFullView(page);
  });

  test("so they are with a 40 px camera cutout, which shortens the panel with the card", async ({ page }) => {
    await insets(page, { left: 40 });
    await expect.poll(() => page.locator("main").evaluate((el) => getComputedStyle(el).paddingLeft)).toBe("48px");
    await settled(page);
    await inFullView(page);
  });
});
