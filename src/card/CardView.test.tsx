// To do:
// [x] the DOM contract: frame > flipper[data-side] > two faces, front then back
// [x] the hidden face is inert and aria-hidden; the face on show is neither
// [x] the front: the question, and nothing else
// [x] the back: one paper sheet per page, each holding its page's answer and nothing else (the question is on the
//     front, a tap away); the page shown is current, the next peeks below, the previous above, the rest are away
// [x] a card with one page has one sheet, current, and its frame takes vertical pans as before; a multi-page back
//     marks the frame data-paged, so the browser leaves vertical drags to the pages
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

const paged: Card = { ...vacuum, id: "paged", answerPages: ["<p>One.</p>", "<p>Two.</p>", "<p>Three.</p>"] };

// The sheets of the back, by their position.
const sheets = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(`.${styles.sheet}`)).map((sheet) => sheet.dataset.pos);

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

  it("writes the answer on one sheet of the back, and nothing else: no question, no topics, no count", () => {
    const back = renderFace("back");
    const answer = within(back);
    expect(answer.queryByRole("heading")).toBeNull();
    expect(answer.getByText("UPDATE").tagName).toBe("CODE");
    expect(answer.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "It also freezes old transaction ids.",
      "Autovacuum runs it in the background.",
    ]);
    expect(back.children).toHaveLength(1);
    expect(back.firstElementChild?.children).toHaveLength(1);
    expect(back.textContent).not.toMatch(/Postgres|Queues|\d \/ \d/);
  });

  it("gives a card with one page one current sheet, its frame taking vertical pans as before", () => {
    const { container } = render(<CardView card={vacuum} side="back" page={0} />);
    expect(sheets(container)).toEqual(["current"]);
    expect(container.firstElementChild?.hasAttribute("data-paged")).toBe(false);
  });

  it("lays a multi-page back out as sheets: the page shown current, the next below, the previous above, the rest away", () => {
    const { container, rerender } = render(<CardView card={paged} side="back" page={0} />);
    expect(sheets(container)).toEqual(["current", "next", "away"]);
    expect(container.firstElementChild?.hasAttribute("data-paged")).toBe(true);
    expect(Array.from(container.querySelectorAll(`.${styles.sheet}`), (s) => s.textContent)).toEqual([
      "One.",
      "Two.",
      "Three.",
    ]);

    rerender(<CardView card={paged} side="back" page={1} />);
    expect(sheets(container)).toEqual(["prev", "current", "next"]);
    rerender(<CardView card={paged} side="back" page={2} />);
    expect(sheets(container)).toEqual(["away", "prev", "current"]);
  });

  it("leaves the frame to vertical pans while the front of a multi-page card shows", () => {
    const { container } = render(<CardView card={paged} side="front" page={0} />);
    expect(container.firstElementChild?.hasAttribute("data-paged")).toBe(false);
  });

  it("fits every sheet on its own: each carries data-fit once measured", () => {
    const { container } = render(<CardView card={paged} side="back" page={0} />);
    const fitted = Array.from(container.querySelectorAll<HTMLElement>(`.${styles.sheet}`), (s) => s.dataset.fit);
    expect(fitted).toEqual(["0", "0", "0"]);
  });

  it("announces nothing itself: it mounts with its text, so the app's own live region says where you are", () => {
    const { container } = render(<CardView card={vacuum} side="front" />);
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("fits the front and the back's sheet on their own: both carry data-fit once measured", () => {
    const { container } = render(<CardView card={vacuum} side="front" />);
    const front = container.querySelector<HTMLElement>(`.${styles.front}`);
    const sheet = container.querySelector<HTMLElement>(`.${styles.sheet}`);
    expect([front?.dataset.fit, sheet?.dataset.fit]).toEqual(["0", "0"]);
  });
});

function renderFace(side: "front" | "back"): HTMLElement {
  const { container } = render(<CardView card={vacuum} side={side} />);
  const face = container.querySelector<HTMLElement>(side === "front" ? `.${styles.face}` : `.${styles.back}`);
  if (!face) throw new Error(`no ${side} face`);
  return face;
}
