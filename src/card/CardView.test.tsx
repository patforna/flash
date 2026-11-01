// To do:
// [x] the DOM contract: frame > flipper[data-side] > two faces, front then back
// [x] the hidden face is inert and aria-hidden; the face on show is neither
// [x] the front: the question, and nothing else
// [x] the back: the answer, and nothing else (the question is on the front, a tap away)
// [x] a back with pages: every page in order, each after a break (an hr the stylesheet turns into one empty ruled
//     line); the answer scrolls (data-scroll) and a pencil ↓ says there is more; a one-page back has none of it
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

describe("CardView", () => {
  it("keeps the DOM contract: frame > flipper[data-side] > two faces, front then back", () => {
    const { container } = render(<CardView card={vacuum} side="front" />);
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
    const { container } = render(<CardView card={vacuum} side={side} />);
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

  it("writes the answer on the back, and nothing else: no question, no topics, no count", () => {
    const back = renderFace("back");
    const answer = within(back);
    expect(answer.queryByRole("heading")).toBeNull();
    expect(answer.getByText("UPDATE").tagName).toBe("CODE");
    expect(answer.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "It also freezes old transaction ids.",
      "Autovacuum runs it in the background.",
    ]);
    expect(back.children).toHaveLength(1);
    expect(back.textContent).not.toMatch(/Postgres|Queues|\d \/ \d/);
    expect(back.querySelector("hr")).toBeNull();
    expect(back.hasAttribute("data-pages")).toBe(false);
    expect(back.querySelector("[data-scroll]")).toBeNull();
  });

  it("writes every page of a longer answer in order, a break between them, and says there is more", () => {
    const paged: Card = { ...vacuum, answerPages: ["<p>One.</p>", "<p>Two.</p><ul><li>a</li></ul>", "<p>Three.</p>"] };
    const { container } = render(<CardView card={paged} side="back" />);
    const back = container.querySelector<HTMLElement>(`.${styles.back}`) as HTMLElement;
    const answer = back.firstElementChild as HTMLElement;
    expect(back.dataset.pages).toBe("3");
    expect(answer.hasAttribute("data-scroll")).toBe(true);
    expect(Array.from(answer.children, (el) => el.tagName.toLowerCase())).toEqual(["p", "hr", "p", "ul", "hr", "p"]);
    expect(answer.textContent).toBe("One.Two.aThree.");
    // The pencil arrow, outside the scroller so it stays put, hidden from assistive tech.
    const more = back.lastElementChild as HTMLElement;
    expect(more).not.toBe(answer);
    expect(more.textContent).toBe("↓");
    expect(more.getAttribute("aria-hidden")).toBe("true");
  });

  it("announces nothing itself: it mounts with its text, so the app's own live region says where you are", () => {
    const { container } = render(<CardView card={vacuum} side="front" />);
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("fits each face on its own: both carry data-fit once measured", () => {
    const { container } = render(<CardView card={vacuum} side="front" />);
    const faces = Array.from(container.querySelectorAll<HTMLElement>(`.${styles.face}`));
    expect(faces.map((face) => face.dataset.fit)).toEqual(["0", "0"]);
  });
});

function renderFace(side: "front" | "back"): HTMLElement {
  const { container } = render(<CardView card={vacuum} side={side} />);
  const face = container.querySelector<HTMLElement>(side === "front" ? `.${styles.face}` : `.${styles.back}`);
  if (!face) throw new Error(`no ${side} face`);
  return face;
}
