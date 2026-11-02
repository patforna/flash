// To do:
// [x] a card always shows the same wear: it follows from its id
// [x] only occasionally: most cards are clean, none carries more than two marks
// [x] every kind turns up, each on a small share of the cards
// [x] each mark differs from card to card (nearly always): rings and soft corners at all four corners, creases at many angles
// [x] a soft corner rounds the front at its corner and the back at the mirrored one (the card turns around X)
import { describe, expect, it } from "vitest";
import { type Kind, wearFor } from "./wear";

const ids = Array.from({ length: 4000 }, (_, i) => `question-${i}-${(i * 7919).toString(36)}`);
const all = ids.map(wearFor);
const withKind = (kind: Kind) => all.flatMap((wear) => wear.marks.filter((mark) => mark.kind === kind));

describe("wearFor", () => {
  it("gives a card the same wear every time", () => {
    expect(wearFor("why-does-postgres-need-vacuum")).toEqual(wearFor("why-does-postgres-need-vacuum"));
  });

  it("marks a card only now and then, and never with more than two marks", () => {
    const marked = all.filter((wear) => wear.marks.length > 0).length / all.length;
    expect(marked).toBeGreaterThan(0.25);
    expect(marked).toBeLessThan(0.45);
    expect(Math.max(...all.map((wear) => wear.marks.length))).toBe(2);
  });

  it.each(["ring", "corner", "crease", "foxing", "fibres", "edges"] as const)(
    "puts a %s on a small share of the cards",
    (kind) => {
      const share = withKind(kind).length / all.length;
      expect(share).toBeGreaterThan(1 / 30);
      expect(share).toBeLessThan(1 / 8);
    },
  );

  it("varies every mark from card to card", () => {
    for (const kind of ["ring", "corner", "crease", "foxing", "fibres", "edges"] as const) {
      const looks = new Set(withKind(kind).map((mark) => JSON.stringify(mark)));
      expect(looks.size / withKind(kind).length, kind).toBeGreaterThan(0.85);
    }
  });

  it("puts rings and soft corners at all four corners", () => {
    const quarter = (x: number, y: number) => `${x < 300 ? "left" : "right"} ${y < 180 ? "top" : "bottom"}`;
    const rings = new Set(
      withKind("ring").map((mark) => quarter(Number(mark.vars["--cx"]), Number(mark.vars["--cy"]))),
    );
    expect(rings.size).toBe(4);
    const corners = new Set(withKind("corner").map((mark) => `${mark.vars["--x"]} ${mark.vars["--y"]}`));
    expect(corners).toEqual(new Set(["0% 0%", "100% 0%", "0% 100%", "100% 100%"]));
  });

  it("rounds a soft corner on the front, and the mirrored corner on the back", () => {
    for (const wear of all.filter((w) => w.marks.some((mark) => mark.kind === "corner"))) {
      const [front] = Object.entries(wear.front);
      const [back] = Object.entries(wear.back);
      if (!front || !back) throw new Error("a soft corner rounds both faces");
      const mirror = { "--r-tl": "--r-bl", "--r-tr": "--r-br", "--r-bl": "--r-tl", "--r-br": "--r-tr" } as const;
      expect(back).toEqual([mirror[front[0] as keyof typeof mirror], front[1]]);
      expect(Number(front[1])).toBeGreaterThanOrEqual(22);
      expect(Number(front[1])).toBeLessThanOrEqual(38);
    }
    for (const wear of all.filter((w) => !w.marks.some((mark) => mark.kind === "corner"))) {
      expect(wear.front).toEqual({});
      expect(wear.back).toEqual({});
    }
  });
});
