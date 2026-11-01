// To do:
// [x] a layer per role through renderCard, each with data-role and a lift inside; the previous and next layers inert
// [x] the blank cards behind show while at least 2, and at least 3, cards remain after the current one; both under
//     the end card, coming and going with the move to it and from it (data-closing, data-opening), not as it lands
// [x] a tap flips the card; on the end card it goes next (which reshuffles), flying the end card off as a swipe does;
//     so do the end card's button and s
// [x] onMove as each move is decided: a release, a key, a button, a tap on the end card; never a flip
// [x] a swipe commits through the view once its animation finishes; the new card is at rest before paint
// [x] data-state: idle, dragging, animating
// [x] the press: data-pressed on the current layer from pointerdown to release, never a transform on it
// [x] data-flipping from a change of side until the flipper's transform transition ends, or the flip's duration
// [x] a new card from elsewhere (a reshuffle, a topic change) is dealt; one that survives isn't, nor one swiped to
// [x] a swipe on the end card deals the next pass at once, under a copy of the end card flying off
// [x] buttons: "Show answer" / "Show question", "Previous" and "Next", which go as a swipe does
// [x] the buttons stay put, so focus never falls to the page: "Previous" is aria-disabled on a first card; on the end
//     card the third reads "Shuffle again"
// [x] shortcuts: ↓ scrolls the back's scroller while it can and flips once it can't; ↑ likewise; a front has none
// [x] shortcuts: → and ← go as a swipe does, Space flips, s reshuffles, f calls onFullscreen; s goes by the card a move
//     in flight lands on; neither Space nor s touches a card under a thumb
// (Styles aren't computed here: happy-dom gets no CSS modules. The feel check covers them in Chromium.)
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Card } from "../../shared/types";
import type { DeckView, Side } from "../deck/types";
import { FakeAnimation, inline, press } from "../gesture/testing";
import { CardStage } from "./CardStage";

// The card: 600 × 360 at (280, 24), as the gesture's tests have it.
const rect = { x: 280, y: 24, left: 280, top: 24, right: 880, bottom: 384, width: 600, height: 360 };
let animations: FakeAnimation[] = [];

beforeEach(() => {
  animations = [];
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rect as DOMRect);
  vi.spyOn(Element.prototype, "animate").mockImplementation(function (this: Element, keyframes, options) {
    const animation = new FakeAnimation(this, keyframes as Keyframe[], options as KeyframeAnimationOptions);
    animations.push(animation);
    return animation as unknown as Animation;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const card = (id: string): Card => ({
  id,
  topics: ["Redis"],
  questionHtml: `${id}?`,
  answerPages: id === "a" ? [`${id}.`, "more", "and more"] : [`${id}.`],
});

interface Pass {
  order: Card[];
  index: number;
  side: Side;
}

// A pass as useDeck gives it: every move lands front up; past the last card, the end card, whose next reshuffles.
interface ReaderProps {
  calls: string[];
  onFullscreen(): void;
  onMove(): void;
  start: number;
  held: { view?: DeckView };
}

function Reader({ calls, onFullscreen, onMove, start, held }: ReaderProps) {
  const [pass, setPass] = useState<Pass>({ order: ["a", "b", "c", "d"].map(card), index: start, side: "front" });
  const { order, index, side } = pass;
  const n = order.length;
  const move = (name: string, to: (p: Pass) => Pass) => () => {
    calls.push(name);
    setPass(to);
  };
  const rotate = (cards: Card[]) => [...cards.slice(1), ...cards.slice(0, 1)];
  const view: DeckView = {
    prev: order[index - 1] ?? null,
    current: order[index] ?? "end",
    next: order[index + 1] ?? (index === n - 1 ? "end" : null),
    side,
    position: index + 1,
    total: n,
    selected: new Set(),
    flip: move("flip", (p) => ({ ...p, side: p.side === "front" ? "back" : "front" })),
    goNext: move("goNext", (p) =>
      p.index === n ? { order: rotate(p.order), index: 0, side: "front" } : { ...p, index: p.index + 1, side: "front" },
    ),
    // On a pass's first card it changes nothing, and keeps the state, so React skips the render.
    goPrev: move("goPrev", (p) => (p.index > 0 ? { ...p, index: p.index - 1, side: "front" } : p)),
    reshuffle: move("reshuffle", (p) => ({ order: rotate(p.order), index: 0, side: "front" })),
    // A topic change that keeps the card on screen: a new pass with it first, on the same side.
    toggleTopic: move("toggleTopic", (p) => ({
      order: [p.order[p.index] ?? card("x"), card("y"), card("z")],
      index: 0,
      side: p.side,
    })),
    clearTopics: move("clearTopics", (p) => p),
  };
  held.view = view;
  return (
    <CardStage
      view={view}
      renderCard={(c, role) => (
        <div key={c === "end" ? "end" : c.id} data-side={role === "current" ? side : "front"}>
          {c === "end" ? "That's all" : c.questionHtml}
          {c !== "end" && c.answerPages.length > 1 && <div data-scroll="" data-testid={`scroller-${c.id}`} />}
        </div>
      )}
      onFullscreen={onFullscreen}
      onTopics={() => {}}
      onMove={onMove}
    />
  );
}

// The pass starts at card `start` (0 to 3, or 4 for the end card).
function setup({ start = 0 } = {}) {
  const calls: string[] = [];
  const onFullscreen = vi.fn();
  // Each move as it is decided, among the reader's calls.
  const onMove = vi.fn(() => calls.push("move"));
  const held: { view?: DeckView } = {};
  const view = render(
    <StrictMode>
      <Reader calls={calls} onFullscreen={onFullscreen} onMove={onMove} start={start} held={held} />
    </StrictMode>,
  );
  // The view as the reader last rendered it, for changes that come from elsewhere (keys, the topic panel).
  const deck = () => {
    if (!held.view) throw new Error("not rendered");
    return held.view;
  };
  const stage = view.container.firstElementChild as HTMLElement;
  const layer = (role: string) => {
    const el = stage.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (!el) throw new Error(`no ${role} layer`);
    return el;
  };
  return { stage, layer, calls, onFullscreen, deck };
}

describe("layers", () => {
  test("a layer per role, each with its card from renderCard inside a lift; only the current one is live", () => {
    const { stage } = setup();
    const layers = [...stage.querySelectorAll("[data-role]")].map((el) => [
      el.getAttribute("data-role"),
      el.firstElementChild?.textContent,
      el.hasAttribute("inert"),
    ]);
    expect(layers).toEqual([
      ["next", "b?", true],
      ["current", "a?", false],
      ["prev", "", true],
    ]);
  });

  test("the blank cards behind thin out: two while 3 cards remain after this one, one while 2 do, then none", () => {
    const blanks = (start: number) => setup({ start }).stage.querySelectorAll("[data-shown]").length;
    expect([0, 1, 2, 3].map(blanks)).toEqual([2, 1, 0, 0]);
  });

  test("the end card lies on the pass it closes: both blank cards under it, ready to shuffle", () => {
    expect(setup({ start: 4 }).stage.querySelectorAll("[data-shown]")).toHaveLength(2);
  });

  test("they come with the move to the end card, as it is decided, not as it lands", async () => {
    const { stage, layer } = setup({ start: 3 });
    flick(stage, layer);
    expect(stage.hasAttribute("data-closing")).toBe(true);
    await land();
    expect(stage.hasAttribute("data-closing")).toBe(false);
    expect(stage.querySelectorAll("[data-shown]")).toHaveLength(2);
  });

  test("…and go with the move back from it", async () => {
    const { stage } = setup({ start: 4 });
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(stage.hasAttribute("data-opening")).toBe(true);
    await land();
    expect(stage.hasAttribute("data-opening")).toBe(false);
    expect(stage.querySelectorAll("[data-shown]")).toHaveLength(0);
  });

  test("no other move marks them", async () => {
    const { stage, layer } = setup({ start: 1 });
    flick(stage, layer);
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    await land();
    expect([stage.hasAttribute("data-closing"), stage.hasAttribute("data-opening")]).toEqual([false, false]);
  });
});

describe("taps", () => {
  test("a tap flips the card", () => {
    const { stage, layer, calls } = setup();
    press(stage, layer("current"), 700, 200).up(80);
    expect(calls).toEqual(["flip"]);
    expect(layer("current").querySelector("[data-side]")?.getAttribute("data-side")).toBe("back");
  });

  test("a tap on the end card is a move: it flies off as a swipe does, going next, which reshuffles", () => {
    const { stage, layer, calls } = setup({ start: 4 });
    press(stage, layer("current"), 700, 200).up(80);
    expect(calls).toEqual(["move", "goNext"]);
    expect(endCardFlyingOff()).toBe(true);
  });
});

// A flick left at 2.5 px/ms.
function flick(stage: HTMLElement, layer: (role: string) => HTMLElement) {
  const finger = press(stage, layer("current"), 700, 200);
  for (let i = 1; i <= 8; i++) finger.move(700 - 20 * i, 200);
  finger.up();
}

// A copy of the end card, off the stage's roles, flying off over the pass dealt under it.
const endCardFlyingOff = () =>
  animations.some((a) => a.el.textContent === "That's all" && !a.el.hasAttribute("data-role") && a.el.isConnected);

const land = () =>
  act(async () => {
    for (const animation of animations) animation.finish();
  });

describe("swipes", () => {
  test("a flick left is a move as it is let go, and goes next once the card has flown, at rest before paint", async () => {
    const { stage, layer, calls } = setup();
    flick(stage, layer);
    expect(calls).toEqual(["move"]);
    await land();
    expect(calls).toEqual(["move", "goNext"]);
    expect(layer("current").textContent).toBe("b?");
    expect(animations.map((a) => a.playState)).toEqual(["idle", "idle"]);
    for (const role of ["prev", "current", "next"])
      expect(inline(layer(role))).toEqual({ transform: "", visibility: "" });
  });

  test("data-state follows it: idle, dragging, animating, idle", async () => {
    const { stage, layer } = setup();
    expect(stage.dataset.state).toBe("idle");
    const finger = press(stage, layer("current"), 700, 200);
    expect(stage.dataset.state).toBe("idle");
    finger.move(650, 200);
    expect(stage.dataset.state).toBe("dragging");
    finger.up();
    expect(stage.dataset.state).toBe("animating");
    await land();
    expect(stage.dataset.state).toBe("idle");
  });
});

describe("the press", () => {
  test("marks the card pressed from pointerdown to release, for its lift to rise; never a transform on the layer", () => {
    const { stage, layer } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    expect(layer("current").hasAttribute("data-pressed")).toBe(true);
    expect(layer("current").style.transform).toBe("");
    finger.up(80);
    expect(layer("current").hasAttribute("data-pressed")).toBe(false);
  });

  test("ends when the browser takes the pointer", () => {
    const { stage, layer } = setup();
    press(stage, layer("current"), 700, 200).cancel();
    expect(layer("current").hasAttribute("data-pressed")).toBe(false);
  });
});

// happy-dom's TransitionEvent drops propertyName, so it is set as timeStamp is on pointers.
function transitionEnd(el: Element, propertyName: string) {
  act(() => {
    const event = new Event("transitionend", { bubbles: true });
    Object.defineProperty(event, "propertyName", { value: propertyName });
    el.dispatchEvent(event);
  });
}

describe("flipping", () => {
  test("data-flipping is set when the side changes, until the flipper's transform transition ends", () => {
    const { stage, layer } = setup();
    press(stage, layer("current"), 700, 200).up(80);
    expect(stage.hasAttribute("data-flipping")).toBe(true);
    const flipper = layer("current").querySelector("[data-side]");
    if (!flipper) throw new Error("no flipper");
    transitionEnd(flipper, "opacity");
    expect(stage.hasAttribute("data-flipping")).toBe(true);
    transitionEnd(flipper, "transform");
    expect(stage.hasAttribute("data-flipping")).toBe(false);
  });

  test("…or for the flip's duration, should no transition end come", () => {
    vi.useFakeTimers();
    try {
      const { stage, layer } = setup();
      stage.style.setProperty("--flip-duration", "380ms");
      press(stage, layer("current"), 700, 200).up(80);
      act(() => vi.advanceTimersByTime(379));
      expect(stage.hasAttribute("data-flipping")).toBe(true);
      act(() => vi.advanceTimersByTime(1));
      expect(stage.hasAttribute("data-flipping")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("…read with its unit, as the build's minifier writes the token (.38s)", () => {
    vi.useFakeTimers();
    try {
      const { stage, layer } = setup();
      stage.style.setProperty("--flip-duration", ".38s");
      press(stage, layer("current"), 700, 200).up(80);
      act(() => vi.advanceTimersByTime(379));
      expect(stage.hasAttribute("data-flipping")).toBe(true);
      act(() => vi.advanceTimersByTime(1));
      expect(stage.hasAttribute("data-flipping")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("under reduced motion, for the cross-fade's duration", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) => ({ matches: query.includes("reduce") }) as MediaQueryList,
    );
    try {
      const { stage, layer } = setup();
      stage.style.setProperty("--flip-duration", "380ms");
      stage.style.setProperty("--flip-fade-duration", "140ms");
      press(stage, layer("current"), 700, 200).up(80);
      act(() => vi.advanceTimersByTime(140));
      expect(stage.hasAttribute("data-flipping")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("a new card isn't a flip, and ends one still running", async () => {
    const { stage, layer } = setup();
    stage.style.setProperty("--flip-duration", "10s");
    press(stage, layer("current"), 700, 200).up(80);
    expect(stage.hasAttribute("data-flipping")).toBe(true);
    flick(stage, layer);
    await land();
    expect(layer("current").textContent).toBe("b?");
    expect(stage.hasAttribute("data-flipping")).toBe(false);
  });
});

describe("dealing", () => {
  const deal = [
    { transform: "translateY(14px)", opacity: 0 },
    { transform: "translateY(0px)", opacity: 1 },
  ];

  test("a new card from elsewhere, here a reshuffle, is dealt", () => {
    const { layer, deck } = setup();
    act(() => deck().reshuffle());
    expect(layer("current").textContent).toBe("b?");
    expect(animations.filter((a) => a.el === layer("current")).map((a) => a.keyframes)).toEqual([deal]);
  });

  test("so is the first card, when the stage is told to deal it (after the loading card)", () => {
    render(
      <CardStage
        view={{
          prev: null,
          current: card("a"),
          next: card("b"),
          side: "front",
          position: 1,
          total: 2,
          selected: new Set(),
          flip: () => {},
          goNext: () => {},
          goPrev: () => {},
          reshuffle: () => {},
          toggleTopic: () => {},
          clearTopics: () => {},
        }}
        renderCard={(c) => <div key={c === "end" ? "end" : c.id}>{c === "end" ? "end" : c.questionHtml}</div>}
        onFullscreen={() => {}}
        onTopics={() => {}}
        onMove={() => {}}
        dealFirst
      />,
    );
    expect(animations.map((a) => a.keyframes)).toContainEqual(deal);
  });

  test("a card that survives a topic change isn't", () => {
    const { layer, deck } = setup();
    act(() => deck().toggleTopic("Redis"));
    expect(layer("next").textContent).toBe("y?");
    expect(animations).toEqual([]);
  });

  test("a topic change while the previous card slides back leaves nothing filling", async () => {
    const { layer, deck } = setup({ start: 1 });
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    const [slide] = animations;
    expect(slide?.el).toBe(layer("prev"));
    // The card on screen survives at the head of a new pass, so the slide lands on nothing to go back to.
    act(() => deck().toggleTopic("Redis"));
    await land();
    expect(animations.map((a) => a.playState)).toEqual(["idle"]);
    expect(inline(layer("prev"))).toEqual({ transform: "", visibility: "" });
  });

  test("…and a touch landing that slide early carries no card in: the card on screen stays where it is", () => {
    const { stage, layer, deck } = setup({ start: 1 });
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    act(() => deck().toggleTopic("Redis"));
    const before = animations.length;
    press(stage, layer("current"), 700, 200);
    expect(layer("current").textContent).toBe("b?");
    expect(animations.slice(before)).toEqual([]);
  });

  test("a reshuffle mid-fling deals the new pass under the card flying out, which flies on as it was", () => {
    const { layer, deck } = setup();
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    act(() => deck().reshuffle());
    expect(layer("current").textContent).toBe("b?");
    const copy = animations.find((a) => !a.el.hasAttribute("data-role") && a.el.isConnected);
    expect(copy?.el.textContent).toBe("a?");
  });

  test("swiping on from the end card deals the new pass at once, under the end card flying off", () => {
    const { stage, layer, calls } = setup({ start: 4 });
    flick(stage, layer);
    expect(calls).toEqual(["move", "goNext"]);
    expect(layer("current").textContent).toBe("b?");
    expect(animations.map((a) => [a.el, a.keyframes])).toContainEqual([layer("current"), deal]);
    // A copy of the end card, off the stage's roles, flies on over it.
    const copy = animations.find((a) => a.el.textContent === "That's all" && !a.el.hasAttribute("data-role"));
    expect(copy?.el.isConnected).toBe(true);
  });
});

describe("buttons", () => {
  test('"Show answer" flips the card, then reads "Show question"', () => {
    const { calls } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(calls).toEqual(["flip"]);
    expect(screen.getByRole("button", { name: "Show question" })).toBeTruthy();
  });

  test('"Next" and "Previous" go as a swipe does', async () => {
    const { layer, calls } = setup({ start: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(animations[0]?.el).toBe(layer("current"));
    await land();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(animations.at(-1)?.el).toBe(layer("prev"));
    await land();
    expect(calls).toEqual(["move", "goNext", "move", "goPrev"]);
  });

  test('"Previous" is off on a pass\'s first card, yet keeps the focus it has: pressed, it does nothing', () => {
    const { calls } = setup();
    const previous = screen.getByRole("button", { name: "Previous" });
    expect(previous.getAttribute("aria-disabled")).toBe("true");
    expect(previous).toHaveProperty("disabled", false);
    fireEvent.click(previous);
    expect(calls).toEqual([]);
    expect(animations).toEqual([]);
    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("aria-disabled")).toBe(false);
  });

  test('the end card has no back: its third button reads "Shuffle again" and flies it off, dealing the next pass', () => {
    const { calls } = setup({ start: 4 });
    expect(screen.queryByRole("button", { name: "Show answer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Shuffle again" }));
    expect(calls).toEqual(["move", "goNext"]);
    expect(endCardFlyingOff()).toBe(true);
  });
});

describe("shortcuts", () => {
  test("→ and ← go as a swipe does", async () => {
    const { layer, calls } = setup({ start: 1 });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(animations[0]?.el).toBe(layer("current"));
    await land();
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    await land();
    expect(calls).toEqual(["move", "goNext", "move", "goPrev"]);
  });

  test("on the end card, s flies it off as a swipe does, going next, which reshuffles", () => {
    const { calls } = setup({ start: 4 });
    fireEvent.keyDown(document.body, { key: "s" });
    expect(calls).toEqual(["move", "goNext"]);
    expect(endCardFlyingOff()).toBe(true);
  });

  test("↓ scrolls a long back while it can, 60 % of the card at a time, and flips once it can't; ↑ likewise", () => {
    const { layer, calls } = setup();
    // Card a has three pages; the stage finds the scroller in the card on top once it shows its back.
    fireEvent.keyDown(document.body, { key: " " });
    expect(calls).toEqual(["flip"]);
    const scroller = layer("current").querySelector<HTMLElement>("[data-scroll]") as HTMLElement;
    Object.defineProperty(layer("current"), "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 500 });
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy;

    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    expect(scrollBy).toHaveBeenCalledWith({ top: 180, behavior: "smooth" });
    expect(calls).toEqual(["flip"]);

    scroller.scrollTop = 300; // at the end
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["flip", "flip"]);
  });

  test("↓ and ↑ flip a card with one page, as Space does", () => {
    const { calls } = setup({ start: 1 });
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    fireEvent.keyDown(document.body, { key: "ArrowUp" });
    expect(calls).toEqual(["flip", "flip"]);
  });

  test("Space flips, s reshuffles, f asks for fullscreen", () => {
    const { calls, onFullscreen } = setup();
    fireEvent.keyDown(document.body, { key: " " });
    fireEvent.keyDown(document.body, { key: "s" });
    fireEvent.keyDown(document.body, { key: "f" });
    expect(calls).toEqual(["flip", "reshuffle"]);
    expect(onFullscreen).toHaveBeenCalledOnce();
  });

  test("s while the last card comes back over the end card goes by the card that lands: it reshuffles", async () => {
    const { layer, calls } = setup({ start: 4 });
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    fireEvent.keyDown(document.body, { key: "s" });
    await land();
    expect(calls).toEqual(["move", "goPrev", "reshuffle"]);
    expect(layer("current").textContent).toBe("b?");
  });

  test("Space and s do nothing while a drag is in progress: the card under the thumb is the thumb's", () => {
    const { stage, layer, calls } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(650, 200);
    fireEvent.keyDown(document.body, { key: " " });
    fireEvent.keyDown(document.body, { key: "s" });
    expect(calls).toEqual([]);
    expect(layer("current").textContent).toBe("a?");
    expect(layer("current").querySelector("[data-side]")?.getAttribute("data-side")).toBe("front");
    finger.up();
  });
});
