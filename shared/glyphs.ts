// The characters the card fonts cover: the union of both files' cmaps, since the question's marker falls back to the
// answer's fineliner for what it lacks (the arrows). Hex code points and inclusive ranges, extracted once from the
// repo root with:
//
//   uvx --with fonttools --with brotli python - src/fonts/klee-one-*.woff2 src/fonts/covered-by-your-grace-*.woff2 <<'PY'
//   import sys
//   from fontTools.ttLib import TTFont
//   runs = []
//   for cp in sorted(set().union(*(TTFont(f).getBestCmap() for f in sys.argv[1:]))):
//       if runs and runs[-1][1] == cp - 1: runs[-1][1] = cp
//       else: runs.append([cp, cp])
//   print(",".join(f"{a:x}" if a == b else f"{a:x}-{b:x}" for a, b in runs))
//   PY
const RANGES =
  "20-7e,a0-ff,131,152-153,2bb-2bc,2c6,2da,2dc,304,308,2002-2003,2010-2016,2018-201a,201c-201e,2020-2022," +
  "2025-2026,2030,2032-2033,2039-203c,203e,2044,2049,205a,205d,20ac,2122,2190-2194,2196-2199,2212,2215,221e,2260";

const covered = new Set<number>();
for (const range of RANGES.split(",")) {
  const first = Number.parseInt(range, 16); // parseInt stops at the "-"
  const last = Number.parseInt(range.slice(range.indexOf("-") + 1), 16); // the whole range when there is no "-"
  for (let codePoint = first; codePoint <= last; codePoint++) covered.add(codePoint);
}

export function isCovered(codePoint: number): boolean {
  return covered.has(codePoint);
}
