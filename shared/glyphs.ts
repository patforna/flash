// The characters the card fonts cover: the union of the three files' cmaps, since the question's marker falls back to
// the answer's pen for what it lacks, and the pen to the arrows' file. Hex code points and inclusive ranges, extracted
// once from the repo root (U+0000, a control character in the marker's file, left out) with:
//
//   uvx --with fonttools --with brotli python - src/fonts/caveat-*.woff2 src/fonts/permanent-marker-*.woff2 src/fonts/klee-one-arrows-*.woff2 <<'PY'
//   import sys
//   from fontTools.ttLib import TTFont
//   runs = []
//   for cp in sorted(set().union(*(TTFont(f).getBestCmap() for f in sys.argv[1:]))):
//       if runs and runs[-1][1] == cp - 1: runs[-1][1] = cp
//       else: runs.append([cp, cp])
//   print(",".join(f"{a:x}" if a == b else f"{a:x}-{b:x}" for a, b in runs))
//   PY
const RANGES =
  "20-7e,a0-ff,131,152-153,2bc,2c6,2da,2dc,304,308,2010,2013-2014,2018-201a,201c-201e,2020-2022,2026,2030," +
  "2032-2033,2039-203a,2044,2052,2070,2074-2079,20ac,2122,2190-2194,2196-2199,2212,2215,221e,2248,2260,2264-2265";

const covered = new Set<number>();
for (const range of RANGES.split(",")) {
  const first = Number.parseInt(range, 16); // parseInt stops at the "-"
  const last = Number.parseInt(range.slice(range.indexOf("-") + 1), 16); // the whole range when there is no "-"
  for (let codePoint = first; codePoint <= last; codePoint++) covered.add(codePoint);
}

export function isCovered(codePoint: number): boolean {
  return covered.has(codePoint);
}
