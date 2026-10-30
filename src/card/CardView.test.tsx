// To do:
// [x] the DOM contract: frame > flipper[data-side] > two faces, front then back
// [x] the hidden face is inert and aria-hidden; the face on show is neither
// [x] the front: the question, and the band in the first topic's colour
// [x] the front: the card's topics as dots with labels, each dot in its topic's colour
// [x] the front: the counter, the position zero-padded to the total's width ("07 / 16")
// [x] the back: the question again in its header, then the answer
// [x] each face carries data-fit once measured
import { configure, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "../../shared/types";
import { CardView } from "./CardView";
import styles from "./card.module.css";

configure({ reactStrictMode: true });

const vacuum: Card = {
  id: "why-does-postgres-need-vacuum",
  topics: ["Postgres", "Queues"],
  questionHtml: "Why does Postgres need <code>VACUUM</code>?",
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
    expect(faces.map((face) => face.matches(`.${styles.face}`))).toEqual([true, true]);
    expect(faces.map((face) => face.matches(`.${styles.back}`))).toEqual([false, true]);
  });

  it.each([
    ["front", [false, true]],
    ["back", [true, false]],
  ] as const)("on the %s hides the other face from input and assistive tech", (side, hidden) => {
    const { container } = render(<CardView card={vacuum} side={side} position={7} total={16} colourOf={colourOf} />);
    const faces = Array.from(container.querySelectorAll<HTMLElement>(`.${styles.face}`));
    expect(faces.map((face) => face.inert)).toEqual(hidden);
    expect(faces.map((face) => face.getAttribute("aria-hidden") === "true")).toEqual(hidden);
  });

  it("writes the question on the front, under a band in the first topic's colour", () => {
    const front = renderFace("front");
    const question = within(front).getByRole("heading");
    expect(question.textContent).toBe("Why does Postgres need VACUUM?");
    expect(question.querySelector("code")?.textContent).toBe("VACUUM");
    expect(front.querySelector<HTMLElement>(`.${styles.band}`)?.style.backgroundColor).toBe("var(--s-mint)");
  });

  it("labels the front with the card's topics, each with a dot in its colour", () => {
    const topics = within(renderFace("front")).getAllByRole("listitem");
    expect(topics.map((topic) => topic.textContent)).toEqual(["Postgres", "Queues"]);
    expect(topics.map((topic) => topic.querySelector<HTMLElement>(`.${styles.dot}`)?.style.backgroundColor)).toEqual([
      "var(--s-mint)",
      "var(--s-sky)",
    ]);
  });

  it.each([
    [7, 16, "07 / 16"],
    [7, 9, "7 / 9"],
    [12, 120, "012 / 120"],
  ])("counts card %i of %i on the front as %s, politely live", (position, total, text) => {
    const { container } = render(
      <CardView card={vacuum} side="front" position={position} total={total} colourOf={colourOf} />,
    );
    const front = container.querySelector<HTMLElement>(`.${styles.face}`) as HTMLElement;
    const counter = within(front).getByText(text);
    expect(counter.getAttribute("aria-live")).toBe("polite");
  });

  it("writes the question again in the back's header, the answer under it and the counter", () => {
    const back = within(renderFace("back"));
    expect(back.getByRole("heading").textContent).toBe("Why does Postgres need VACUUM?");
    expect(back.getByText("UPDATE").tagName).toBe("CODE");
    expect(back.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "It also freezes old transaction ids.",
      "Autovacuum runs it in the background.",
    ]);
    expect(back.getByText("07 / 16")).toBeTruthy();
  });

  it("fits each face on its own: both carry data-fit once measured", () => {
    const { container } = render(<CardView card={vacuum} side="front" position={7} total={16} colourOf={colourOf} />);
    const faces = Array.from(container.querySelectorAll<HTMLElement>(`.${styles.face}`));
    expect(faces.map((face) => face.dataset.fit)).toEqual(["0", "0"]);
  });
});

function renderFace(side: "front" | "back"): HTMLElement {
  const { container } = render(<CardView card={vacuum} side={side} position={7} total={16} colourOf={colourOf} />);
  const face = container.querySelector<HTMLElement>(side === "front" ? `.${styles.face}` : `.${styles.back}`);
  if (!face) throw new Error(`no ${side} face`);
  return face;
}
