// To do:
// [x] the DOM contract: frame > flipper[data-side] > two faces, front then back
// [ ] the hidden face is inert and aria-hidden; the face on show is neither
// [ ] the front: the question, and the band in the first topic's colour
// [ ] the front: the card's topics as dots with labels, each dot in its topic's colour
// [ ] the front: the counter, the position zero-padded to the total's width ("07 / 16")
// [ ] the back: the question again in its header, then the answer
// [ ] each face carries data-fit once measured
import { configure, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "../../shared/types";
import styles from "./card.module.css";
import { CardView } from "./CardView";

configure({ reactStrictMode: true });

const vacuum: Card = {
  id: "why-does-postgres-need-vacuum",
  topics: ["Postgres", "Queues"],
  questionHtml: "Why does Postgres need VACUUM?",
  answerHtml:
    "<p>MVCC never changes a row in place: an <code>UPDATE</code> writes a new row version.<br>VACUUM makes that space reusable.</p>" +
    "<ul><li>It also freezes old transaction ids.</li><li>Autovacuum runs it in the background.</li></ul>",
};

const colourOf = (topic: string) => ({ Postgres: "var(--s-mint)", Queues: "var(--s-sky)" })[topic] ?? "";

beforeEach(() => {
  // happy-dom has no document.fonts; the faces' fonts count as loaded.
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { check: () => true, load: vi.fn(() => Promise.resolve([])) },
  });
});

afterEach(() => {
  Reflect.deleteProperty(document, "fonts");
});

describe("CardView", () => {
  it("keeps the DOM contract: frame > flipper[data-side] > two faces, front then back", () => {
    const { container } = render(<CardView card={vacuum} side="front" position={7} total={16} colourOf={colourOf} />);
    const frame = container.firstElementChild as HTMLElement;
    const flipper = frame.firstElementChild as HTMLElement;
    const faces = Array.from(flipper.children);
    expect(frame.className).toBe(styles.frame);
    expect(flipper.className).toBe(styles.flipper);
    expect(flipper.dataset.side).toBe("front");
    expect(faces.map((face) => face.classList.contains(styles.face))).toEqual([true, true]);
    expect(faces.map((face) => face.classList.contains(styles.back))).toEqual([false, true]);
  });
});
