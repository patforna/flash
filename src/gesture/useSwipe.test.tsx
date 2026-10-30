// To do:
// [x] a tap calls onTap; a long hold doesn't; never after a drag
// [x] a horizontal drag writes translate and rotate on the current layer
// [x] the card underneath scales and rises with progress
// [x] a right drag shows the previous layer, following from −cardRect.right; changing direction hands over
// [x] a right drag without a previous card rubber-bands the current one
// [x] zero React commits during a drag
// [x] a release past the threshold flings at the release speed (fill: forwards only here), out to half a card past
//     gone; the card underneath rises
// [x] onDecide as a release, a key or a button commits, before anything flies; never on a cancel
// [x] onCommit once the fling finishes; then the fling is cancelled and inline styles cleared
// [x] a commit to the previous card slides it in to 0
// [x] a cancel animates back with the cancel timing and leaves nothing filling
// [x] a vertical drag and a pointercancel do nothing; a pointercancel mid-drag cancels
// [x] only the first pointer counts; a pointer that went down off the card, on a button or with another button is ignored
// [x] a pointerdown during a commit finishes it, completing the commit (flushSync) before reading layers() again
// [x] …while a copy of the flying card flies on from where it was, out of the stage's way, and goes when it lands
// [x] the end card (no card under it) is let go of at once: the move lands while a copy flies off
// [x] a pointerdown during a cancel or a deal finishes it
// [x] reduced motion: no rotation while following; opacity-only animations
// [x] commit(dir): the same fling from rest on MOTION.commitEase; not where can() forbids, nor while a pointer is down
// [x] tap(): completes a running commit, then onTap
// [x] deal(): drops a running commit; translateY(14px) → 0 and opacity 0 → 1 over 220 ms
// [x] a horizontal drag finishes a running flip
import { act, render } from "@testing-library/react";
import { Profiler, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeAnimation, inline, press } from "./testing";
import { type SwipeOptions, useSwipe } from "./useSwipe";

// The card: 600 × 360 at (280, 24). 28 % of it is 168 px; off screen to the left is −(880 + 80) = −960 px. The previous
// card waits at −880 px, its right edge on the screen's left edge, so a right drag shows it from the first pixel.
const card = { x: 280, y: 24, left: 280, top: 24, right: 880, bottom: 384, width: 600, height: 360 };

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(card as DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A stage with real layer elements. Each commit brings new ones, as a new card would.
type Swipe = ReturnType<typeof useSwipe>;

interface StageProps {
  options: SwipeOptions;
  prev: boolean;
  next: boolean;
  held: { swipe?: Swipe };
}

function Stage({ options, prev, next, held }: StageProps) {
  const stage = useRef<HTMLDivElement>(null);
  const [commits, setCommits] = useState(0);
  held.swipe = useSwipe(stage, {
    ...options,
    layers: () => {
      const find = (role: string) => stage.current?.querySelector<HTMLElement>(`[data-role="${role}"]`) ?? null;
      const current = find("current");
      return current && { current, next: next ? find("next") : null, prev: prev ? find("prev") : null };
    },
    onCommit: (dir) => {
      options.onCommit(dir);
      setCommits((n) => n + 1);
    },
  });
  return (
    <div ref={stage} data-testid="stage">
      {(["next", "current", "prev"] as const).map((role) => (
        <div key={`${role}-${commits}`} data-role={role} />
      ))}
    </div>
  );
}

// Without `next`, there is no card under the one on top: it is the end card.
function setup(overrides: Partial<SwipeOptions> = {}, { prev = true, next = true } = {}) {
  const animations: FakeAnimation[] = [];
  const onTap = vi.fn();
  const onDecide = vi.fn();
  const onCommit = vi.fn();
  const options: SwipeOptions = {
    layers: () => null,
    can: () => ({ prev: true, next: true }),
    onTap,
    onDecide,
    onCommit,
    reducedMotion: () => false,
    animate: (el, keyframes, opts) => {
      const animation = new FakeAnimation(el, keyframes, opts);
      animations.push(animation);
      return animation as unknown as Animation;
    },
    ...overrides,
  };
  let renders = 0;
  const held: { swipe?: Swipe } = {};
  const view = render(
    <Profiler id="stage" onRender={() => renders++}>
      <Stage options={options} prev={prev} next={next} held={held} />
    </Profiler>,
  );
  const stage = view.getByTestId("stage");
  const layer = (role: string) => {
    const el = stage.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (!el) throw new Error(`no ${role} layer`);
    return el;
  };
  const swipe = () => {
    if (!held.swipe) throw new Error("not rendered");
    return held.swipe;
  };
  return { stage, layer, animations, onTap, onDecide, onCommit, renders: () => renders, swipe };
}

describe("taps", () => {
  test("a tap calls onTap", () => {
    const { stage, layer, onTap } = setup();
    press(stage, layer("current"), 700, 200).up(100);
    expect(onTap).toHaveBeenCalledOnce();
  });

  test("a hold longer than 350 ms is not a tap", () => {
    const { stage, layer, onTap } = setup();
    press(stage, layer("current"), 700, 200).up(400);
    expect(onTap).not.toHaveBeenCalled();
  });

  test("a drag that comes back to where it started is not a tap", () => {
    const { stage, layer, onTap } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(680, 200);
    finger.move(700, 200);
    finger.up();
    expect(onTap).not.toHaveBeenCalled();
  });
});

describe("following the finger", () => {
  test("a horizontal drag moves the current card 1:1 and tilts it, up to 7°", () => {
    const { stage, layer } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(650, 205);
    expect(layer("current").style.transform).toBe("translateX(-50px) rotate(-1.5deg)");
    finger.move(500, 210);
    expect(layer("current").style.transform).toBe("translateX(-200px) rotate(-6deg)");
    finger.move(300, 210);
    expect(layer("current").style.transform).toBe("translateX(-400px) rotate(-7deg)");
  });

  test("the card underneath grows and rises as the drag nears the commit distance", () => {
    const { stage, layer } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(616, 200);
    expect(layer("next").style.transform).toBe("scale(0.9825) translateY(4px)");
    finger.move(400, 200);
    expect(layer("next").style.transform).toBe("scale(1) translateY(0px)");
  });

  test("a right drag pulls the previous card back in over the current one, from off screen", () => {
    const { stage, layer } = setup();
    const finger = press(stage, layer("current"), 400, 200);
    finger.move(450, 200);
    expect(layer("prev").style.visibility).toBe("visible");
    expect(layer("prev").style.transform).toBe("translateX(-830px)");
    finger.move(600, 200);
    expect(layer("prev").style.transform).toBe("translateX(-680px)");
    expect(layer("current").style.transform).toBe("");
    expect(layer("next").style.transform).toBe("");
  });

  test("makes no React commits", () => {
    const { stage, layer, renders } = setup();
    const before = renders();
    const finger = press(stage, layer("current"), 700, 200);
    for (const x of [690, 660, 600, 520, 450, 600, 760]) finger.move(x, 200);
    expect(renders()).toBe(before);
  });

  test("changing direction mid-drag hands over between the cards", () => {
    const { stage, layer } = setup();
    const finger = press(stage, layer("current"), 400, 200);
    finger.move(550, 200);
    finger.move(350, 200);
    expect(inline(layer("prev"))).toEqual({ transform: "", visibility: "" });
    expect(layer("current").style.transform).toBe("translateX(-50px) rotate(-1.5deg)");
    finger.move(450, 200);
    expect(layer("current").style.transform).toBe("");
    expect(layer("next").style.transform).toBe("");
    expect(inline(layer("prev"))).toEqual({ transform: "translateX(-830px)", visibility: "visible" });
  });

  test("with no previous card, a right drag only gives a little, like a rubber band", () => {
    const { stage, layer } = setup({}, { prev: false });
    const finger = press(stage, layer("current"), 400, 200);
    finger.move(480, 200);
    expect(layer("current").style.transform).toBe("translateX(28.3871px) rotate(0.8516deg)");
    expect(layer("next").style.transform).toBe("");
  });
});

// A drag left at 2.5 px/ms to dx −160 (short of 168 px, but fast). Released, a card flies half its width further
// than gone, −(880 + 80 + 300) = −1260 px, so it slows down only off screen: 1100 px to go.
function flick(stage: HTMLElement, layer: (role: string) => HTMLElement) {
  const finger = press(stage, layer("current"), 700, 200);
  for (let i = 1; i <= 8; i++) finger.move(700 - 20 * i, 200);
  finger.up();
}

describe("releasing", () => {
  test("past the threshold flings the card off at its release speed, the card underneath rising with it", () => {
    const { stage, layer, animations } = setup();
    flick(stage, layer);
    const [fling, rise] = animations;
    expect(fling?.el).toBe(layer("current"));
    expect(fling?.keyframes).toEqual([
      { transform: "translateX(-160px) rotate(-4.8deg)" },
      { transform: "translateX(-1260px) rotate(-10deg)" },
    ]);
    expect(fling?.options).toEqual({ duration: 320, easing: "cubic-bezier(0.2, 0.145, 0.3, 1)", fill: "forwards" });
    expect(rise?.el).toBe(layer("next"));
    expect(rise?.keyframes).toEqual([
      { transform: "scale(0.9983) translateY(0.381px)" },
      { transform: "scale(1) translateY(0px)" },
    ]);
    expect(rise?.options).toEqual({ duration: 320, easing: "cubic-bezier(0.2, 0.145, 0.3, 1)" });
  });
});

describe("deciding", () => {
  test("a release past the threshold decides the move at once, before the card has flown; a cancel decides none", () => {
    const { stage, layer, onDecide, onCommit } = setup();
    flick(stage, layer);
    expect(onDecide).toHaveBeenCalledExactlyOnceWith("next");
    expect(onCommit).not.toHaveBeenCalled();
    const finger = press(stage, layer("current"), 400, 200, 1000);
    finger.move(450, 200, 50);
    finger.up(100);
    expect(onDecide).toHaveBeenCalledOnce();
  });

  test("so do a key and a button, where there is a card to go to", () => {
    const { onDecide, swipe } = setup({ can: () => ({ prev: false, next: true }) });
    act(() => swipe().commit("prev"));
    expect(onDecide).not.toHaveBeenCalled();
    act(() => swipe().commit("next"));
    expect(onDecide).toHaveBeenCalledExactlyOnceWith("next");
  });
});

describe("committing", () => {
  test("commits once the fling finishes, then lets go of it and clears what it wrote", async () => {
    const { stage, layer, animations, onCommit } = setup();
    const before = { current: layer("current"), next: layer("next") };
    flick(stage, layer);
    expect(onCommit).not.toHaveBeenCalled();
    await act(async () => {
      for (const animation of animations) animation.finish();
    });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("next");
    expect(animations.map((a) => a.playState)).toEqual(["idle", "idle"]);
    expect(inline(before.current)).toEqual({ transform: "", visibility: "" });
    expect(inline(before.next)).toEqual({ transform: "", visibility: "" });
  });

  test("the release speed counts the samples the browser coalesced into each move", () => {
    const { stage, layer, animations } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    // One move after 200 ms; only its coalesced samples show the last 50 px took 50 ms, a flick.
    finger.move(600, 200, 200, [
      { x: 650, t: 150 },
      { x: 600, t: 200 },
    ]);
    finger.up();
    expect(animations[0]?.keyframes.at(-1)).toEqual({ transform: "translateX(-1260px) rotate(-10deg)" });
  });

  test("a flick right slides the previous card in to its place, then commits", async () => {
    const { stage, layer, animations, onCommit } = setup();
    const finger = press(stage, layer("current"), 400, 200);
    for (let i = 1; i <= 8; i++) finger.move(400 + 20 * i, 200);
    finger.up();
    const [slide] = animations;
    expect(slide?.el).toBe(layer("prev"));
    expect(slide?.keyframes).toEqual([{ transform: "translateX(-720px)" }, { transform: "translateX(0px)" }]);
    expect(slide?.options).toEqual({ duration: 320, easing: "cubic-bezier(0.2, 0.222, 0.3, 1)", fill: "forwards" });
    await act(async () => slide?.finish());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("prev");
  });
});

describe("cancelling", () => {
  const cancel = { duration: 260, easing: "cubic-bezier(0.3, 1.25, 0.5, 1)" };

  test("a short, slow drag springs back to rest, ending at the resting style with nothing filling", async () => {
    const { stage, layer, animations, onCommit } = setup();
    const current = layer("current");
    const next = layer("next");
    const finger = press(stage, current, 700, 200);
    finger.move(650, 200, 50);
    finger.up(100);
    expect(animations.map((a) => [a.el, a.keyframes, a.options])).toEqual([
      [
        current,
        [{ transform: "translateX(-50px) rotate(-1.5deg)" }, { transform: "translateX(0px) rotate(0deg)" }],
        cancel,
      ],
      [
        next,
        [{ transform: "scale(0.9754) translateY(5.619px)" }, { transform: "scale(0.965) translateY(8px)" }],
        cancel,
      ],
    ]);
    expect(inline(current)).toEqual({ transform: "", visibility: "" });
    expect(inline(next)).toEqual({ transform: "", visibility: "" });
    await act(async () => {
      for (const animation of animations) animation.finish();
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  test("a cancelled right drag sends the previous card back off screen, then hides it again", async () => {
    const { stage, layer, animations } = setup();
    const prev = layer("prev");
    const finger = press(stage, layer("current"), 400, 200);
    finger.move(450, 200, 50);
    finger.up(100);
    expect(animations.map((a) => [a.el, a.keyframes, a.options])).toEqual([
      [prev, [{ transform: "translateX(-830px)" }, { transform: "translateX(-960px)" }], cancel],
    ]);
    expect(inline(prev)).toEqual({ transform: "translateX(-960px)", visibility: "visible" });
    await act(async () => animations[0]?.finish());
    expect(inline(prev)).toEqual({ transform: "", visibility: "" });
  });
});

describe("ignoring", () => {
  test("a vertical drag does nothing", () => {
    const { stage, layer, animations, onTap, onCommit } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(696, 160);
    finger.move(640, 120);
    finger.up();
    expect(inline(layer("current"))).toEqual({ transform: "", visibility: "" });
    expect(animations).toEqual([]);
    expect(onTap).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  test("only the first pointer counts", () => {
    const { stage, layer, onTap } = setup();
    const first = press(stage, layer("current"), 700, 200);
    first.move(600, 200);
    const second = press(stage, layer("current"), 500, 200, 20, { pointerId: 2, isPrimary: false });
    second.move(530, 200);
    second.up();
    expect(layer("current").style.transform).toBe("translateX(-100px) rotate(-3deg)");
    expect(inline(layer("prev"))).toEqual({ transform: "", visibility: "" });
    first.move(550, 200);
    expect(layer("current").style.transform).toBe("translateX(-150px) rotate(-4.5deg)");
    expect(onTap).not.toHaveBeenCalled();
  });

  test("the stage captures the pointer it follows, so a drag that strays off it still ends", () => {
    const { stage, layer } = setup();
    press(stage, layer("current"), 700, 200);
    expect(stage.hasPointerCapture(1)).toBe(true);
  });

  test("a pointer that goes down off the card is ignored", () => {
    const { stage, onTap } = setup();
    press(stage, stage, 100, 200).up(50);
    expect(onTap).not.toHaveBeenCalled();
  });

  test("a press on a button over the card is left to the button", () => {
    const { stage, onTap } = setup();
    const button = document.createElement("button");
    stage.append(button);
    press(stage, button, 700, 200).up(50);
    expect(onTap).not.toHaveBeenCalled();
  });

  test("a mouse's other buttons are ignored", () => {
    const { stage, layer, onTap } = setup();
    press(stage, layer("current"), 700, 200, 0, { pointerType: "mouse", button: 2 }).up(50);
    expect(onTap).not.toHaveBeenCalled();
  });

  test("a pointercancel mid-drag springs the card back", () => {
    const { stage, layer, animations } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(500, 200);
    finger.cancel();
    expect(animations.map((a) => a.keyframes.at(-1))).toEqual([
      { transform: "translateX(0px) rotate(0deg)" },
      { transform: "scale(0.965) translateY(8px)" },
    ]);
  });
});

describe("input during an animation", () => {
  test("a pointerdown mid-fling finishes it and commits at once, then drags the card now on top", async () => {
    const { stage, layer, animations, onCommit } = setup();
    flick(stage, layer);
    const [fling] = animations;
    const finger = press(stage, layer("next"), 700, 200, 100);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("next");
    expect(fling?.playState).toBe("idle");
    finger.move(650, 200);
    expect(layer("current").style.transform).toBe("translateX(-50px) rotate(-1.5deg)");
    await act(async () => {});
    expect(onCommit).toHaveBeenCalledOnce();
  });
  test("…while a copy of the flying card flies on from where it was, then goes", async () => {
    const { stage, layer, animations } = setup();
    const flying = layer("current");
    flying.textContent = "the flung card";
    flick(stage, layer);
    const [fling] = animations;
    if (fling) fling.currentTime = 100;
    press(stage, layer("next"), 700, 200, 100);
    const copy = animations.find((a) => a.el !== flying && a.el.textContent === "the flung card");
    if (!copy || !(copy.el instanceof HTMLElement)) throw new Error("no copy flies on");
    expect([copy.keyframes, copy.options, copy.currentTime]).toEqual([fling?.keyframes, fling?.options, 100]);
    // Over the stack, out of the way: no role for the stage's lookups, no input, nothing read out.
    expect(copy.el.isConnected).toBe(true);
    expect(copy.el.hasAttribute("data-role")).toBe(false);
    expect([copy.el.inert, copy.el.getAttribute("aria-hidden")]).toEqual([true, "true"]);
    expect(copy.el.style.visibility).toBe("visible");
    await act(async () => copy.finish());
    expect(copy.el.isConnected).toBe(false);
  });

  test("a key mid-fling lets the card fly on too, as a copy", () => {
    const { layer, animations, swipe } = setup();
    const flying = layer("current");
    act(() => swipe().commit("next"));
    act(() => swipe().commit("next"));
    expect(animations.filter((a) => a.el !== flying && !a.el.hasAttribute("data-role"))).toHaveLength(1);
  });

  test("a pointerdown mid-cancel finishes it", () => {
    const { stage, layer, animations } = setup();
    const finger = press(stage, layer("current"), 400, 200);
    finger.move(450, 200, 50);
    finger.up(100);
    press(stage, layer("current"), 700, 200, 200);
    expect(animations[0]?.playState).toBe("finished");
    expect(inline(layer("prev"))).toEqual({ transform: "", visibility: "" });
  });
});

describe("the end card, with no card under it", () => {
  test("is let go of at once: the move lands as it flies off, a copy flying on over the pass dealt under it", () => {
    const { stage, layer, animations, onCommit } = setup({}, { next: false });
    const flying = layer("current");
    flick(stage, layer);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("next");
    const [fling, copy] = animations;
    expect(fling?.el).toBe(flying);
    expect(copy?.el.hasAttribute("data-role")).toBe(false);
    expect(copy?.keyframes).toEqual(fling?.keyframes);
  });

  test("a key does the same", () => {
    const { animations, onCommit, swipe } = setup({}, { next: false });
    act(() => swipe().commit("next"));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("next");
    expect(animations.map((a) => a.el.hasAttribute("data-role"))).toEqual([true, false]);
  });
});

describe("reduced motion", () => {
  const reducedMotion = () => true;

  test("the card still follows the finger, without tilting", () => {
    const { stage, layer } = setup({ reducedMotion });
    press(stage, layer("current"), 700, 200).move(650, 200);
    expect(layer("current").style.transform).toBe("translateX(-50px) rotate(0deg)");
  });
  test("a commit cross-fades: the card fades out over the next one, already in place", async () => {
    const { stage, layer, animations, onCommit } = setup({ reducedMotion });
    flick(stage, layer);
    expect(animations.map((a) => [a.el, a.keyframes, a.options])).toEqual([
      [layer("current"), [{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: "forwards" }],
    ]);
    expect(layer("next").style.transform).toBe("scale(1) translateY(0px)");
    await act(async () => animations[0]?.finish());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("next");
  });
  test("a commit to the previous card fades it in, in place", () => {
    const { stage, layer, animations } = setup({ reducedMotion });
    const finger = press(stage, layer("current"), 400, 200);
    for (let i = 1; i <= 8; i++) finger.move(400 + 20 * i, 200);
    finger.up();
    expect(animations.map((a) => [a.el, a.keyframes, a.options])).toEqual([
      [layer("prev"), [{ opacity: 0 }, { opacity: 1 }], { duration: 140, fill: "forwards" }],
    ]);
    expect(inline(layer("prev"))).toEqual({ transform: "translateX(0px)", visibility: "visible" });
  });

  test("a deal fades in, in place", () => {
    const { layer, animations, swipe } = setup({ reducedMotion });
    act(() => swipe().deal());
    expect(animations.map((a) => [a.el, a.keyframes, a.options])).toEqual([
      [layer("current"), [{ opacity: 0 }, { opacity: 1 }], { duration: 140 }],
    ]);
  });

  test("a cancel puts everything back at once", () => {
    const { stage, layer, animations } = setup({ reducedMotion });
    const finger = press(stage, layer("current"), 400, 200);
    finger.move(450, 200, 50);
    finger.up(100);
    expect(animations).toEqual([]);
    expect(inline(layer("prev"))).toEqual({ transform: "", visibility: "" });
  });
});

describe("commit(dir), for keys and buttons", () => {
  test("flings the card from rest as a swipe does, leaving at once", async () => {
    const { layer, animations, onCommit, swipe } = setup();
    act(() => swipe().commit("next"));
    const timing = { duration: 320, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" };
    expect(animations.map((a) => [a.el, a.keyframes, a.options])).toEqual([
      [
        layer("current"),
        [{ transform: "translateX(0px) rotate(0deg)" }, { transform: "translateX(-960px) rotate(-10deg)" }],
        { ...timing, fill: "forwards" },
      ],
      [
        layer("next"),
        [{ transform: "scale(0.965) translateY(8px)" }, { transform: "scale(1) translateY(0px)" }],
        timing,
      ],
    ]);
    await act(async () => {
      for (const animation of animations) animation.finish();
    });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("next");
  });

  test('commit("prev") brings the previous card in from off screen', async () => {
    const { layer, animations, onCommit, swipe } = setup();
    act(() => swipe().commit("prev"));
    expect(animations.map((a) => [a.el, a.keyframes, a.options])).toEqual([
      [
        layer("prev"),
        [{ transform: "translateX(-880px)" }, { transform: "translateX(0px)" }],
        { duration: 320, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "forwards" },
      ],
    ]);
    expect(layer("prev").style.visibility).toBe("visible");
    await act(async () => animations[0]?.finish());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("prev");
  });

  test("does nothing where there is no card to go to, nor while a finger is down", () => {
    const { stage, layer, animations, swipe } = setup({ can: () => ({ prev: false, next: true }) });
    act(() => swipe().commit("prev"));
    expect(animations).toEqual([]);
    press(stage, layer("current"), 700, 200);
    act(() => swipe().commit("next"));
    expect(animations).toEqual([]);
  });

  test("a second commit before the first lands completes the first, then flings the new card", () => {
    const { layer, animations, onCommit, swipe } = setup();
    act(() => swipe().commit("next"));
    act(() => swipe().commit("next"));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("next");
    expect(animations[0]?.playState).toBe("idle");
    expect(animations.filter((a) => a.el === layer("current"))).toHaveLength(1);
  });
});

describe("tap(), for keys and buttons", () => {
  test("completes a running commit first, so the card that lands is the one that flips", () => {
    const { onTap, onCommit, swipe } = setup();
    act(() => swipe().commit("next"));
    act(() => swipe().tap());
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onTap).toHaveBeenCalledOnce();
    expect(onCommit.mock.invocationCallOrder[0]).toBeLessThan(onTap.mock.invocationCallOrder[0] ?? 0);
  });
});

describe("deal(), when the view brings a new card", () => {
  test("the card on top rises 14 px as it fades in", () => {
    const { layer, animations, swipe } = setup();
    act(() => swipe().deal());
    expect(animations.map((a) => [a.el, a.keyframes, a.options])).toEqual([
      [
        layer("current"),
        [
          { transform: "translateY(14px)", opacity: 0 },
          { transform: "translateY(0px)", opacity: 1 },
        ],
        { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      ],
    ]);
  });

  test("drops a fling in flight without committing it: the pass it belonged to has gone", async () => {
    const { layer, animations, onCommit, swipe } = setup();
    const next = layer("next");
    act(() => swipe().commit("next"));
    act(() => swipe().deal());
    await act(async () => {});
    expect(onCommit).not.toHaveBeenCalled();
    expect(animations.slice(0, 2).map((a) => a.playState)).toEqual(["idle", "idle"]);
    expect(inline(next)).toEqual({ transform: "", visibility: "" });
  });

  test("leaves a drag in progress alone: the new card simply follows the finger", () => {
    const { stage, layer, animations, swipe } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(650, 200);
    act(() => swipe().deal());
    expect(animations).toEqual([]);
    expect(layer("current").style.transform).toBe("translateX(-50px) rotate(-1.5deg)");
  });

  test("a pointerdown mid-deal finishes it", () => {
    const { stage, layer, animations, swipe } = setup();
    act(() => swipe().deal());
    press(stage, layer("current"), 700, 200);
    expect(animations[0]?.playState).toBe("finished");
  });

  test("marks the stage dealing while it runs, for the card underneath to show blank paper", async () => {
    const { stage, animations, swipe } = setup();
    act(() => swipe().deal());
    expect(stage.hasAttribute("data-dealing")).toBe(true);
    await act(async () => animations[0]?.finish());
    expect(stage.hasAttribute("data-dealing")).toBe(false);
  });

  test("…until a pointerdown finishes it, or a fling takes over", () => {
    const { stage, layer, swipe } = setup();
    act(() => swipe().deal());
    press(stage, layer("current"), 700, 200).up(400);
    expect(stage.hasAttribute("data-dealing")).toBe(false);
    act(() => swipe().deal());
    act(() => swipe().commit("next"));
    expect(stage.hasAttribute("data-dealing")).toBe(false);
  });

  test("a deal that replaces one still running keeps the stage dealing", () => {
    const { stage, swipe } = setup();
    act(() => swipe().deal());
    act(() => swipe().deal());
    expect(stage.hasAttribute("data-dealing")).toBe(true);
  });
});

describe("a flip still turning", () => {
  test("is left to turn by a press (a tap reverses it), and finished once a drag is recognised", () => {
    const { stage, layer } = setup();
    const flipper = document.createElement("div");
    flipper.dataset.side = "back";
    layer("current").append(flipper);
    const turning = { finish: vi.fn() };
    flipper.getAnimations = () => [turning as unknown as Animation];
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(695, 200);
    expect(turning.finish).not.toHaveBeenCalled();
    finger.move(690, 200);
    finger.move(650, 200);
    expect(turning.finish).toHaveBeenCalledOnce();
  });

  test.each(["next", "prev"] as const)("is finished by a key or a button going %s, before anything flies", (dir) => {
    const { layer, animations, swipe } = setup();
    const flipper = document.createElement("div");
    flipper.dataset.side = "back";
    layer("current").append(flipper);
    const turning = { finish: vi.fn(() => expect(animations).toEqual([])) };
    flipper.getAnimations = () => [turning as unknown as Animation];
    act(() => swipe().commit(dir));
    expect(turning.finish).toHaveBeenCalledOnce();
    expect(animations).not.toEqual([]);
  });
});
