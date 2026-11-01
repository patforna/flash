// To do:
// [x] the DOM contract: frame > flipper[data-side] > two faces, front then back
// [x] the hidden face is inert and aria-hidden; the face on show is neither
// [x] the front: the question, and nothing else
// [x] the back: the answer's pages, each in its own element, the page on show the only one visible to input and
//     assistive tech; a count "2/3" in pencil on a card with pages, none on a card with one
// [x] the back of a one-page card: the answer and nothing else (the question is on the front, a tap away)
// [x] no live region: the card remounts on every move, so the app announces the position
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
  answerPages: [
    "<p>MVCC never changes a row in place: an <code>UPDATE</code> writes a new row version.<br>VACUUM makes that space reusable.</p>" +
      "<ul><li>It also freezes old transaction ids.</li><li>Autovacuum runs it in the background.</li></ul>",
  ],
};

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

const paged: Card = {
  ...vacuum,
  id: "paged",
  answerPages: ["<p>Page one.</p>", "<p>Page two.</p>", "<p>Page three.</p>"],
};

describe("CardView", () => {
  it("keeps the DOM contract: frame > flipper[data-side] > two faces, front then back", () => {
    const { container } = render(<CardView card={vacuum} side="front" page={0} />);
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
    const { container } = render(<CardView card={vacuum} side={side} page={0} />);
    const faces = Array.from(container.querySelectorAll<HTMLElement>(`.${styles.face}`));
    expect(faces.map((face) => face.inert)).toEqual(hidden);
    expect(faces.map((face) => face.getAttribute("aria-hidden") === "true")).toEqual(hidden);
  });

  it("writes the question on the front, and nothing else", () => {
    const front = renderFace("front");
    const question = within(front).getByRole("heading");
    expect(question.textContent).toBe("Why does Postgres need VACUUM?");
    expect(question.querySelector("code")?.textContent).toBe("VACUUM");
    expect(Array.from(front.children)).toEqual([question]);
  });

  it("writes a one-page answer on the back, and nothing else: no question, no topics, no count", () => {
    const back = renderFace("back");
    const answer = within(back);
    expect(answer.queryByRole("heading")).toBeNull();
    expect(answer.getByText("UPDATE").tagName).toBe("CODE");
    expect(answer.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "It also freezes old transaction ids.",
      "Autovacuum runs it in the background.",
    ]);
    expect(back.children).toHaveLength(1);
    expect(back.textContent).not.toMatch(/Postgres|Queues|\d\/\d/);
  });

  it("holds every page of a paged answer on the back, the page on show alone reachable, and counts them", () => {
    const { container } = render(<CardView card={paged} side="back" page={1} />);
    const back = container.querySelector<HTMLElement>(`.${styles.back}`);
    if (!back) throw new Error("no back");
    const pages = Array.from(back.querySelectorAll<HTMLElement>(`.${styles.page}`));
    expect(pages.map((p) => p.textContent)).toEqual(["Page one.", "Page two.", "Page three."]);
    expect(pages.map((p) => p.hasAttribute("data-current"))).toEqual([false, true, false]);
    expect(pages.map((p) => p.inert)).toEqual([true, false, true]);
    expect(pages.map((p) => p.getAttribute("aria-hidden") === "true")).toEqual([true, false, true]);
    expect(back.querySelector(`.${styles.count}`)?.textContent).toBe("2/3");
  });

  it("fits each page on its own: every page carries data-fit once measured, the back face none", () => {
    const { container } = render(<CardView card={paged} side="back" page={0} />);
    const back = container.querySelector<HTMLElement>(`.${styles.back}`);
    expect(back?.dataset.fit).toBeUndefined();
    const pages = Array.from(back?.querySelectorAll<HTMLElement>(`.${styles.page}`) ?? []);
    expect(pages.map((p) => p.dataset.fit)).toEqual(["0", "0", "0"]);
  });

  it("announces nothing itself: it mounts with its text, so the app's own live region says where you are", () => {
    const { container } = render(<CardView card={vacuum} side="front" page={0} />);
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("fits the front and the one page of a one-page card on their own: both carry data-fit once measured", () => {
    const { container } = render(<CardView card={vacuum} side="front" page={0} />);
    const front = container.querySelector<HTMLElement>(`.${styles.front}`);
    const page = container.querySelector<HTMLElement>(`.${styles.page}`);
    expect([front?.dataset.fit, page?.dataset.fit]).toEqual(["0", "0"]);
  });
});

function renderFace(side: "front" | "back"): HTMLElement {
  const { container } = render(<CardView card={vacuum} side={side} page={0} />);
  const face = container.querySelector<HTMLElement>(side === "front" ? `.${styles.face}` : `.${styles.back}`);
  if (!face) throw new Error(`no ${side} face`);
  return face;
}
