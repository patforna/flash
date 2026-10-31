// Text contrast over the design tokens (WCAG 2.2, 1.4.3). axe can't judge it on this page: a gradient or a
// pseudo-element lies behind every piece of text, so it reports each one incomplete and none failing.
// To do:
// [x] each ink on the paper; the answer's pen on a highlighter stroke and on the code wash
// [x] the chips' labels: chalk on the desk and its glow; sticker ink on every sticker and on chalk (All)
// [x] a chip not selected: its sticker-tinted label on its muted sticker (OKLab mixes, as the CSS writes them)
// [x] the numerals of a numbered list on the paper
// [x] the error card's red title, large text only, at 3:1
import { describe, expect, test } from "vitest";
import { STICKERS } from "../../shared/stickers";
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

// color-mix(in oklab, a p%, b), as the stickers' tints are written (panel.module.css).
function mix(a: string, share: number, b: string): string {
  const [x, y] = [toOklab(flatten([a])), toOklab(flatten([b]))];
  const name = `mix(${a} ${share * 100}%, ${b})`;
  colours.set(name, { rgb: fromOklab(x.map((c, i) => c * share + (y[i] ?? 0) * (1 - share))), alpha: 1 });
  return name;
}

const toLinear = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

// Björn Ottosson's OKLab, from and to sRGB.
function toOklab(rgb: [number, number, number]): number[] {
  const [r, g, b] = rgb.map(toLinear) as [number, number, number];
  const lms = [
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  ].map(Math.cbrt) as [number, number, number];
  const [l, m, s] = lms;
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L = 0, a = 0, b = 0]: number[]): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(255, Math.max(0, fromLinear(c)))) as [number, number, number];
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

// The stickers' tokens, from the one list the panel and the deck check read.
const STICKER_TOKENS = STICKERS.map((sticker) => `--s-${sticker}`);

// Text and what it is written on, top first: 4.5:1 for text, 3:1 for large text only.
const TEXT: [string, string[]][] = [
  ["--ink-marker", ["--paper"]], // the question
  ["--ink-pen", ["--paper"]], // the answer
  ["--ink-pen", ["--hl"]], // a highlighted word
  ["--ink-pen", ["--code-wash", "--paper"]], // inline code
  ["--ink-pen-soft", ["--paper"]], // the back's header
  ["--ink-pencil", ["--paper"]], // the counter, the card's topics, the message cards' hints
  ["--pen-pink", ["--paper"]], // the numerals of a numbered list
  ["--chalk", ["--desk"]], // a chip's label
  ["--chalk", ["--desk-glow"]],
  ["--sticker-ink", ["--chalk"]], // All, selected
  ...STICKER_TOKENS.map((sticker): [string, string[]] => ["--sticker-ink", [sticker]]), // a topic, selected
  // A chip not selected: its label tinted with its sticker on a muted sticker, all on the desk.
  ...["--chalk", ...STICKER_TOKENS].map((sticker): [string, string[]] => [
    mix(sticker, 0.35, "--chalk"),
    [mix(sticker, 0.18, "--desk")],
  ]),
];

describe("text contrast", () => {
  test.each(TEXT)("%s on %s: at least 4.5:1", (text, background) => {
    expect(ratio(text, background)).toBeGreaterThanOrEqual(4.5);
  });

  test("the error card's title, red on paper and large: at least 3:1", () => {
    expect(ratio("--rule-red", ["--paper"])).toBeGreaterThanOrEqual(3);
  });
});
