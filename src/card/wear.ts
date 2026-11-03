import { fnv1a, stream } from "./seed";

// About half the cards show their age: a coffee ring, one soft corner, a crease, foxing, or edges gone warm. A card
// has at most two, each placed and weighted afresh per card from its id, so no two look alike and a card always looks
// the same. Each mark is a layer of the face (card.module.css) set through its custom properties, in card units where
// it has a size; the back shows the front's marks upside down.
export type Kind = "ring" | "corner" | "crease" | "foxing" | "edges";

type Vars = Record<`--${string}`, string>;

export interface Mark {
  kind: Kind;
  vars: Vars;
}

export interface Wear {
  marks: Mark[];
  // The faces' own corner radii, in card units: a soft corner rounds one, the back's mirrored top to bottom.
  front: Vars;
  back: Vars;
}

// How often each kind turns up, in this order of precedence when more than two come up together.
const CHANCE: [Kind, number][] = [
  ["ring", 1 / 8],
  ["corner", 1 / 8],
  ["crease", 1 / 12],
  ["foxing", 1 / 9],
  ["edges", 1 / 7],
];

const MIRROR = { tl: "bl", tr: "br", bl: "tl", br: "tr" } as const;

export function wearFor(id: string): Wear {
  const random = stream(fnv1a(`wear/${id}`));
  const between = (low: number, high: number, digits = 2) => (low + (high - low) * random()).toFixed(digits);
  const marks: Mark[] = [];
  let front: Vars = {};
  let back: Vars = {};
  for (const [kind, chance] of CHANCE) {
    if (random() >= chance || marks.length === 2) continue;
    if (kind === "ring") {
      // A cup set down once, mostly off a corner or an edge, its broken edge turned one of four ways.
      const size = Number(between(120, 190, 0));
      const corner = random() < 0.7;
      const off = () => Number(between(-0.3, 0.12)) * size;
      const left = random() < 0.5;
      const top = random() < 0.5;
      const cx = corner ? (left ? off() : 600 - off()) : Number(between(120, 480, 0));
      const cy = top ? off() : 360 - off();
      marks.push({
        kind,
        vars: {
          "--cx": cx.toFixed(0),
          "--cy": cy.toFixed(0),
          "--s": String(size),
          "--fx": random() < 0.5 ? "1" : "-1",
          "--fy": random() < 0.5 ? "1" : "-1",
          "--o": between(0.07, 0.12),
        },
      });
    } else if (kind === "corner") {
      // One corner worn round where a thumb takes the card, and a shade of handling around it.
      const at = (["tl", "tr", "bl", "br"] as const)[Math.floor(random() * 4)] ?? "br";
      const radius = between(22, 38, 0);
      front = { [`--r-${at}`]: radius };
      back = { [`--r-${MIRROR[at]}`]: radius };
      marks.push({
        kind,
        vars: {
          "--x": at.endsWith("l") ? "0%" : "100%",
          "--y": at.startsWith("t") ? "0%" : "100%",
          "--s": between(80, 130, 0),
          "--o": between(0.08, 0.15),
        },
      });
    } else if (kind === "crease") {
      // A fold pressed flat again, across the card or down it, a lit side and a shaded side.
      const across = random() < 0.5;
      marks.push({
        kind,
        vars: {
          "--a": `${across ? between(-10, 10, 1) : between(80, 100, 1)}deg`,
          "--at": `${between(25, 75, 1)}%`,
          "--light": between(0.18, 0.35),
          "--shade": between(0.04, 0.08),
        },
      });
    } else if (kind === "foxing") {
      // A few rust specks in a cluster near an edge, as damp leaves them.
      const nearSide = random() < 0.5;
      const x0 = nearSide ? (random() < 0.5 ? 18 : 582) : Number(between(60, 540, 0));
      const y0 = nearSide ? Number(between(60, 300, 0)) : random() < 0.5 ? 18 : 342;
      const specks = Array.from({ length: 3 + Math.floor(random() * 3) }, () => {
        const x = x0 + Number(between(-30, 30, 1));
        const y = y0 + Number(between(-30, 30, 1));
        const size = between(1.2, 3.2);
        const alpha = between(8, 15, 0);
        return `radial-gradient(calc(${size} * var(--u)) calc(${size} * 0.8 * var(--u)) at calc(${x} * var(--u)) calc(${y} * var(--u)), rgb(150 95 45 / ${alpha}%), rgb(150 95 45 / ${Number(alpha) / 3}%) 55%, transparent)`;
      });
      marks.push({ kind, vars: { "--specks": specks.join(", ") } });
    } else {
      // The stock gone a shade warmer from the outside in, more on one side.
      marks.push({
        kind,
        vars: { "--x": `${between(35, 65, 0)}%`, "--y": `${between(35, 65, 0)}%`, "--o": between(0.1, 0.15) },
      });
    }
  }
  return { marks, front, back };
}
