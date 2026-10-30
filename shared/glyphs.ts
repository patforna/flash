// The characters the card fonts cover: the union of both files' cmaps, since the font stack falls back from Shantell
// to Radon. Hex code points and inclusive ranges, extracted once from the repo root with:
//
//   uvx --with fonttools --with brotli python - src/fonts/*.woff2 <<'PY'
//   import sys
//   from fontTools.ttLib import TTFont
//   runs = []
//   for cp in sorted(set().union(*(TTFont(f).getBestCmap() for f in sys.argv[1:]))):
//       if runs and runs[-1][1] == cp - 1: runs[-1][1] = cp
//       else: runs.append([cp, cp])
//   print(",".join(f"{a:x}" if a == b else f"{a:x}-{b:x}" for a, b in runs))
//   PY
const RANGES =
  "20-7e,a0-128,12a-148,14a-17e,18f,192,19d,1e6-1e7,1ea-1eb,1fc-1ff,218-21b,232-233,237,259,272,2bc,2c6-2c7,2d8-2dd," +
  "300-304,306-30c,323,326-328,3a9,1e80-1e85,1e9e,1ea0,1eb8-1eb9,1ebc-1ebd,1eca-1ecd,1ee4-1ee5,1ef2-1ef3,1ef8-1ef9," +
  "2013-2014,2018-201a,201c-201e,2020-2023,2026,2030,2032-2033,2039-203a,2044,2070,2074-2079,2080-2089,20a1,20a9,20ac," +
  "20b1,20ba,20bd,20bf,2113,2116,2122,2153-2154,215b-215e,2190-2199,21a9-21aa,21ba-21bb,21c4,21c6,2200,2202-2203," +
  "2206-2208,220f-2212,2215,221a,221e,2220,2227-2228,222b,2234,2237,2248,2260-2261,2264-2265,2282,2295,25b2,25b4,25b6," +
  "25b8,25bc,25be,25c0,25c2,25ca,2b0e-2b11,e123";

const covered = new Set<number>();
for (const range of RANGES.split(",")) {
  const first = Number.parseInt(range, 16); // parseInt stops at the "-"
  const last = Number.parseInt(range.slice(range.indexOf("-") + 1), 16); // the whole range when there is no "-"
  for (let codePoint = first; codePoint <= last; codePoint++) covered.add(codePoint);
}

export function isCovered(codePoint: number): boolean {
  return covered.has(codePoint);
}
