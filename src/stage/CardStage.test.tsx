// To do:
// [ ] a layer per role through renderCard, each with data-role and a lift inside; the previous and next layers inert
// [ ] the blank cards behind show while at least 2, and at least 3, cards remain after the current one
// [ ] a tap flips the card; on the end card it goes next (which reshuffles)
// [ ] a swipe commits through the view once its animation finishes; the new card is at rest before paint
// [ ] data-state: idle, dragging, animating
// [ ] the press: data-pressed on the current layer from pointerdown to release, never a transform on it
// [ ] data-flipping from a change of side until the flipper's transform transition ends, or the flip's duration
// [ ] a new card from elsewhere (a reshuffle, a topic change) is dealt; one that survives isn't, nor one swiped to
// [ ] buttons: "Show answer" / "Show question", "Previous" and "Next", which go as a swipe does
// [ ] shortcuts: → and ← go as a swipe does, Space flips, s reshuffles, f calls onFullscreen
import { act, render } from "@testing-library/react";
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

const card = (id: string): Card => ({ id, topics: ["Redis"], questionHtml: `${id}?`, answerHtml: `${id}.` });

interface Pass {
  order: Card[];
  index: number;
  side: Side;
}

// A pass as useDeck gives it: every move lands front up; past the last card, the end card, whose next reshuffles.
function Reader({ calls, onFullscreen, start }: { calls: string[]; onFullscreen(): void; start: number }) {
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
    topics: ["Redis"],
    flip: move("flip", (p) => ({ ...p, side: p.side === "front" ? "back" : "front" })),
    goNext: move("goNext", (p) =>
      p.index === n ? { order: rotate(p.order), index: 0, side: "front" } : { ...p, index: p.index + 1, side: "front" },
    ),
    goPrev: move("goPrev", (p) => ({ ...p, index: p.index - 1, side: "front" })),
    reshuffle: move("reshuffle", (p) => ({ order: rotate(p.order), index: 0, side: "front" })),
    // A topic change that keeps the card on screen: the rest of the pass changes behind it.
    toggleTopic: move("toggleTopic", (p) => ({ ...p, order: [p.order[p.index] ?? card("x"), card("y"), card("z")] })),
    clearTopics: move("clearTopics", (p) => p),
  };
  return (
    <CardStage
      view={view}
      renderCard={(c, role) => (
        <div key={c === "end" ? "end" : c.id} data-side={role === "current" ? side : "front"}>
          {c === "end" ? "That's all" : c.questionHtml}
        </div>
      )}
      onFullscreen={onFullscreen}
    />
  );
}

// The pass starts at card `start` (0 to 3, or 4 for the end card).
function setup({ start = 0 } = {}) {
  const calls: string[] = [];
  const onFullscreen = vi.fn();
  const view = render(
    <StrictMode>
      <Reader calls={calls} onFullscreen={onFullscreen} start={start} />
    </StrictMode>,
  );
  const stage = view.container.firstElementChild as HTMLElement;
  const layer = (role: string) => {
    const el = stage.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (!el) throw new Error(`no ${role} layer`);
    return el;
  };
  return { stage, layer, calls, onFullscreen };
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
    expect([0, 1, 2, 3, 4].map(blanks)).toEqual([2, 1, 0, 0, 0]);
  });
});

describe("taps", () => {
  test("a tap flips the card", () => {
    const { stage, layer, calls } = setup();
    press(stage, layer("current"), 700, 200).up(80);
    expect(calls).toEqual(["flip"]);
    expect(layer("current").querySelector("[data-side]")?.getAttribute("data-side")).toBe("back");
  });

  test("a tap on the end card goes next, which reshuffles", () => {
    const { stage, layer, calls } = setup({ start: 4 });
    press(stage, layer("current"), 700, 200).up(80);
    expect(calls).toEqual(["goNext"]);
  });
});

// A flick left at 2.5 px/ms.
function flick(stage: HTMLElement, layer: (role: string) => HTMLElement) {
  const finger = press(stage, layer("current"), 700, 200);
  for (let i = 1; i <= 8; i++) finger.move(700 - 20 * i, 200);
  finger.up();
}

const land = () =>
  act(async () => {
    for (const animation of animations) animation.finish();
  });

describe("swipes", () => {
  test("a flick left goes next once the card has flown, the new card at rest before paint", async () => {
    const { stage, layer, calls } = setup();
    flick(stage, layer);
    expect(calls).toEqual([]);
    await land();
    expect(calls).toEqual(["goNext"]);
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
