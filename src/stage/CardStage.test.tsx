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
import { render } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Card } from "../../shared/types";
import type { DeckView, Side } from "../deck/types";
import { FakeAnimation } from "../gesture/testing";
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
function Reader({ calls, onFullscreen }: { calls: string[]; onFullscreen(): void }) {
  const [pass, setPass] = useState<Pass>({ order: ["a", "b", "c", "d"].map(card), index: 0, side: "front" });
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

function setup() {
  const calls: string[] = [];
  const onFullscreen = vi.fn();
  const view = render(
    <StrictMode>
      <Reader calls={calls} onFullscreen={onFullscreen} />
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
});
