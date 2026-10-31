// Text contrast over the design tokens (WCAG 2.2, 1.4.3). axe can't judge it on this page: a gradient or a
// pseudo-element lies behind every piece of text, so it reports each one incomplete and none failing.
// To do:
// [x] each ink on the paper; the answer's pen on a highlighter stroke and on the code wash
// [x] the chips' labels: chalk on the desk and its glow; sticker ink on every sticker and on chalk (All)
// [x] a chip not selected: its sticker-tinted label on its muted sticker (OKLab mixes, as the CSS writes them)
// [x] the numerals of a numbered list on the paper
// [x] the error card's red title, large text only, at 3:1
import { describe, expect, test } from "vitest";
import tokens from "./tokens.css?raw";

type Rgba = { rgb: [number, number, number]; alpha: number };

// Every colour token: `#rrggbb`, or `rgb(r g b / a%)`.
const channels = (match: RegExpExecArray, radix: number) =>
  [1, 2, 3].map((i) => Number.parseInt(match[i] ?? "", radix)) as Rgba["rgb"];
const colours = new Map<string, Rgba>();
for (const [, name = "", value = ""] of tokens.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  const rgb = /^rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)$/.exec(value);
  if (hex) colours.set(name, { rgb: channels(hex, 16), alpha: 1 });
  if (rgb) colours.set(name, { rgb: channels(rgb, 10), alpha: Number(rgb[4]) / 100 });
}

function colour(token: string): Rgba {
  const found = colours.get(token);
  if (!found) throw new Error(`no colour token ${token}`);
  return found;
}

// A stack of tokens, top first, laid over each other as the browser does (in sRGB), down to an opaque one.
function flatten(stack: string[]): [number, number, number] {
  return stack.reduceRight<[number, number, number]>(
    (below, token) => {
      const { rgb, alpha } = colour(token);
      return rgb.map((c, i) => c * alpha + (below[i] ?? 0) * (1 - alpha)) as [number, number, number];
    },
    [0, 0, 0],
  );
}

// WCAG's relative luminance and contrast ratio.
function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function ratio(text: string, background: string[]): number {
  const [a, b] = [luminance(flatten([text])), luminance(flatten(background))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Text and what it is written on, top first: 4.5:1 for text, 3:1 for large text only.
const TEXT: [string, string[]][] = [
  ["--ink-marker", ["--paper"]], // the question
  ["--ink-pen", ["--paper"]], // the answer
  ["--ink-pen", ["--hl"]], // a highlighted word, where the marker's ink is heaviest (95 %: as good as solid)
  ["--ink-pen", ["--mark-code"]], // inline code in the answer, likewise
  ["--ink-marker", ["--mark-code"]], // inline code in the question
  ["--ink-marker", ["--slip"]], // a code block, typed on its slip
  ["--sticker-ink", ["--hl"]], // the wordmark, in ink on its stroke
  ["--ink-pencil", ["--paper"]], // the message cards' hints
  ["--pen-pink", ["--paper"]], // the numerals of a numbered list
  ["--chalk", ["--desk"]], // the stage's buttons, the controls' glyphs
  ["--chalk", ["--desk-glow"]],
  ["--chalk", ["--desk-deep"]], // a selected row of the topic list
  ["--chalk-dim", ["--desk-deep"]], // a row not selected
];

describe("text contrast", () => {
  test.each(TEXT)("%s on %s: at least 4.5:1", (text, background) => {
    expect(ratio(text, background)).toBeGreaterThanOrEqual(4.5);
  });

  test("the error card's title, red on paper and large: at least 3:1", () => {
    expect(ratio("--rule-red", ["--paper"])).toBeGreaterThanOrEqual(3);
  });
});
