// To do:
// [x] a tap calls onTap; a long hold doesn't; never after a drag
// [x] a horizontal drag writes translate and rotate on the current layer, from the first pixel: while a touch may still
//     be a tap it follows (never bringing out the card before), and is put back if it was one, a hold, vertical or taken
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
// [x] …while a copy of the flying card flies on from where it was, out of the stage's way, and goes when it lands; a key
//     or a deal does the same, the copy taken as the card was flung (a deal finds another card in its layer)
// [x] the end card (no card under it) is let go of at once: the move lands while a copy flies off
// [x] a pointerdown, a key or a button that lands a slide in early lets the card coming back carry on into its place
//     from where it was, out of the next touch's way; a drag the other way or a key going on takes hold of it where it
//     is; the next landing and a deal end it, the landing settling it from where it is into its place underneath, over
//     a copy of the card it was covering, which leaves the layers then
// [x] …while the next touch may still be a tap it is left be, whichever way the touch goes; taken hold of, it leans
//     only as it is dragged on past where it was held, and back in its place it is upright, the card it covers in its own;
//     arrived while the touch waited, it is taken from its place, the drift not made up in a frame
// [x] a pointerdown on the card during a cancel catches the cards where they are, the drag going on from there (a rubber
//     band from where it gives); a tap after it springs them back from there; off the card it finishes the cancel
// [x] a pointerdown during a deal finishes it
// [x] a move (a fling, a slide in, a spring back, a copy flying on) starts at the timeline's time; a deal waits for the
//     next frame
// [x] reduced motion: no rotation while following; opacity-only animations
// [x] commit(dir): the same fling from rest on MOTION.commitEase; not where can() forbids, nor while a pointer is down
// [x] tap() and reshuffle(): complete a running commit, then onTap or onReshuffle; nothing while a pointer is down
// [x] deal(): drops a running commit; translateY(14px) → 0 and opacity 0 → 1 over 220 ms, the card underneath
//     settling from the top card's place to its own
// [x] a horizontal drag finishes a running flip
// [x] no getCoalescedEvents (an insecure context): the move's own sample
// [x] pages: on the back of a card with pages, a vertical drag moves the page's sheet with the finger from the first
//     pixel past the slop, the next sheet rising from where it peeks (or the one before coming down); let go past 28 %
//     of the height, or flung, the page turns: onPage as it is decided, the sheets flying on (fill forwards), then
//     onPageCommit, the fling cancelled and nothing left inline, the sheet that was shown settling into its peek; let go
//     short of that, the sheets spring back on the cancel timing and onPage is not called; at the last page a drag up
//     gives, rubber-banded; page(dir) turns from rest on commitEase; reduced motion cross-fades in place; without
//     pages a vertical drag puts the card back as it did
import { act, cleanup, render } from "@testing-library/react";
import { Profiler, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { animatedAt, FakeAnimation, inline, press } from "./testing";
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
  pages: number; // sheets on the back of the card on top; 0 for a card without pages (or its front)
  held: { swipe?: Swipe };
}

// Where a sheet lies against the page shown, as CardView lays them out.
const posOf = (n: number, page: number) =>
  n === page ? "current" : n === page + 1 ? "next" : n === page - 1 ? "prev" : "away";

function Stage({ options, prev, next, pages, held }: StageProps) {
  const stage = useRef<HTMLDivElement>(null);
  const [commits, setCommits] = useState(0);
  const [page, setPage] = useState(0);
  const find = (selector: string) => stage.current?.querySelector<HTMLElement>(selector) ?? null;
  held.swipe = useSwipe(stage, {
    ...options,
    layers: () => {
      const current = find('[data-role="current"]');
      return (
        current && {
          current,
          next: next ? find('[data-role="next"]') : null,
          prev: prev ? find('[data-role="prev"]') : null,
        }
      );
    },
    pages: () => {
      const current = find('[data-pos="current"]');
      return pages > 0 && current
        ? { current, next: find('[data-pos="next"]'), prev: find('[data-pos="prev"]') }
        : null;
    },
    onCommit: (dir) => {
      options.onCommit(dir);
      setCommits((n) => n + 1);
    },
    onPageCommit: (dir) => {
      options.onPageCommit(dir);
      setPage((p) => p + (dir === "next" ? 1 : -1));
    },
  });
  return (
    <div ref={stage} data-testid="stage">
      {(["next", "current", "prev"] as const).map((role) => (
        <div key={`${role}-${commits}`} data-role={role}>
          {role === "current" &&
            Array.from({ length: pages }, (_, n) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a sheet is its page
              <div key={n} data-pos={posOf(n, page)} data-sheet={n} />
            ))}
        </div>
      ))}
    </div>
  );
}

// Without `next`, there is no card under the one on top: it is the end card. With `pages`, the card on top shows the
// back of a card with that many pages, on page 1.
function setup(overrides: Partial<SwipeOptions> = {}, { prev = true, next = true, pages = 0 } = {}) {
  const animations: FakeAnimation[] = [];
  const onTap = vi.fn();
  const onReshuffle = vi.fn();
  const onDecide = vi.fn();
  const onCommit = vi.fn();
  const onPage = vi.fn();
  const onPageCommit = vi.fn();
  const options: SwipeOptions = {
    layers: () => null,
    pages: () => null,
    can: () => ({ prev: true, next: true }),
    onTap,
    onReshuffle,
    onDecide,
    onCommit,
    onPage,
    onPageCommit,
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
      <Stage options={options} prev={prev} next={next} pages={pages} held={held} />
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
  // The sheet of page n (0-based) of the card on top.
  const sheet = (n: number) => {
    const el = stage.querySelector<HTMLElement>(`[data-sheet="${n}"]`);
    if (!el) throw new Error(`no sheet ${n}`);
    return el;
  };
  return {
    stage,
    layer,
    sheet,
    animations,
    onTap,
    onReshuffle,
    onDecide,
    onCommit,
    onPage,
    onPageCommit,
    renders: () => renders,
    swipe,
  };
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

  test("from the first pixel, while the touch could still be a tap; let go as one, it is put back", () => {
    const { stage, layer, onTap } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(694, 201);
    expect(layer("current").style.transform).toBe("translateX(-6px) rotate(-0.18deg)");
    finger.up(60);
    expect(onTap).toHaveBeenCalledOnce();
    expect(inline(layer("current"))).toEqual({ transform: "", visibility: "" });
    expect(inline(layer("next"))).toEqual({ transform: "", visibility: "" });
  });

  test("…but a tap's jitter to the right never brings out the card before; with none, the card gives", () => {
    const withPrevious = setup();
    press(withPrevious.stage, withPrevious.layer("current"), 700, 200).move(706, 200);
    expect(inline(withPrevious.layer("prev"))).toEqual({ transform: "", visibility: "" });
    expect(withPrevious.layer("current").style.transform).toBe("");
    cleanup();
    const first = setup({}, { prev: false });
    press(first.stage, first.layer("current"), 700, 200).move(706, 200);
    expect(first.layer("current").style.transform).toMatch(/^translateX\(3\.\d+px\)/);
  });

  test("…nor does a move more up or down than sideways, and a drag that turns out vertical puts the card back", () => {
    const { stage, layer, animations } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(697, 204);
    expect(layer("current").style.transform).toBe("");
    finger.move(694, 201);
    expect(layer("current").style.transform).toBe("translateX(-6px) rotate(-0.18deg)");
    finger.move(692, 220);
    expect(inline(layer("current"))).toEqual({ transform: "", visibility: "" });
    expect(animations).toEqual([]);
    // Vertical it stays, however it moves on.
    finger.move(640, 225);
    expect(layer("current").style.transform).toBe("");
  });

  test("…and so does a hold too long for a tap, or the browser taking the pointer", () => {
    const held = setup();
    const finger = press(held.stage, held.layer("current"), 700, 200);
    finger.move(694, 200);
    finger.up(400);
    expect(held.onTap).not.toHaveBeenCalled();
    expect(held.layer("current").style.transform).toBe("");
    cleanup();
    const taken = setup();
    const other = press(taken.stage, taken.layer("current"), 700, 200);
    other.move(694, 200);
    other.cancel();
    expect(taken.layer("current").style.transform).toBe("");
  });
});

// A drag left at 2.5 px/ms to dx −160 (short of 168 px, but fast). Released, a card flies half its width further
// than gone, −(880 + 80 + 300) = −1260 px, so it slows down only off screen: 1100 px to go.
function flick(stage: HTMLElement, layer: (role: string) => HTMLElement) {
  const finger = press(stage, layer("current"), 700, 200);
  for (let i = 1; i <= 8; i++) finger.move(700 - 20 * i, 200);
  finger.up();
}

// The same flick to the right, bringing back the previous card: it has 720 px to go.
function flickRight(stage: HTMLElement, layer: (role: string) => HTMLElement) {
  const finger = press(stage, layer("current"), 400, 200);
  for (let i = 1; i <= 8; i++) finger.move(400 + 20 * i, 200);
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

  test("follows and flings where the browser has no getCoalescedEvents (plain http, away from localhost)", () => {
    // Chromium offers it in secure contexts only; happy-dom puts it on each event.
    class Insecure extends PointerEvent {
      constructor(type: string, init?: PointerEventInit) {
        super(type, init);
        delete (this as { getCoalescedEvents?: unknown }).getCoalescedEvents;
      }
    }
    vi.stubGlobal("PointerEvent", Insecure);
    try {
      const { stage, layer, animations } = setup();
      flick(stage, layer);
      expect(animations[0]?.keyframes.at(-1)).toEqual({ transform: "translateX(-1260px) rotate(-10deg)" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("a flick right slides the previous card in to its place, then commits", async () => {
    const { stage, layer, animations, onCommit } = setup();
    flickRight(stage, layer);
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

  test("so does a deal, as a copy of the card as it was flung: by then its layer holds the card dealt", () => {
    const { layer, animations, swipe } = setup();
    layer("current").textContent = "the flung card";
    act(() => swipe().commit("next"));
    const [fling] = animations;
    if (fling) fling.currentTime = 100;
    // A reshuffle renders the new pass's first card into the same layer, then the stage deals it.
    layer("current").textContent = "the card dealt";
    act(() => swipe().deal());
    const copy = animations.find((a) => !a.el.hasAttribute("data-role"));
    if (!copy || !(copy.el instanceof HTMLElement)) throw new Error("no copy flies on");
    expect(copy.el.textContent).toBe("the flung card");
    expect([copy.keyframes, copy.options, copy.currentTime]).toEqual([fling?.keyframes, fling?.options, 100]);
    expect([copy.el.isConnected, copy.el.inert, copy.el.getAttribute("aria-hidden")]).toEqual([true, true, "true"]);
    expect(animations.filter((a) => a.el === layer("current")).map((a) => a.keyframes)).toContainEqual([
      { transform: "translateY(14px)", opacity: 0 },
      { transform: "translateY(0px)", opacity: 1 },
    ]);
  });

  test("a pointerdown mid-slide lands the move, the card coming back carrying on into its place from where it was", () => {
    const { stage, layer, animations, onCommit } = setup();
    flickRight(stage, layer);
    const [slide] = animations;
    if (slide) slide.currentTime = 80;
    press(stage, layer("current"), 700, 200, 200);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("prev");
    const carry = animations.find((a) => a.el === layer("current"));
    // Its own curve, to its resting style, so nothing is left filling.
    expect([carry?.keyframes, carry?.options, carry?.currentTime]).toEqual([
      slide?.keyframes,
      { duration: 320, easing: "cubic-bezier(0.2, 0.222, 0.3, 1)" },
      80,
    ]);
  });

  test("…over the card it covers, which settles from the place on top into its own in the time left", () => {
    const { stage, layer, animations } = setup();
    flickRight(stage, layer);
    const [slide] = animations;
    if (slide) slide.currentTime = 80;
    press(stage, layer("current"), 700, 200, 200);
    const settles = animations.filter((a) => a.el === layer("next"));
    expect(settles.map((a) => [a.keyframes, a.options])).toEqual([
      [
        [{ transform: "scale(1) translateY(0px)" }, { transform: "scale(0.965) translateY(8px)" }],
        { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      ],
    ]);
  });

  test("…which a drag bringing back the card before leaves be, until that move lands", async () => {
    const { stage, layer, animations } = setup();
    flickRight(stage, layer);
    const before = animations.length;
    const again = press(stage, layer("current"), 400, 200, 200);
    const arriving = animations.slice(before);
    for (let i = 1; i <= 8; i++) again.move(400 + 20 * i, 200);
    again.up();
    expect(arriving.map((a) => a.playState)).toEqual(["running", "running"]);
    expect(layer("current").style.transform).toBe("");
    await act(async () => animations.at(-1)?.finish());
    expect(arriving.map((a) => a.playState)).toEqual(["idle", "idle"]);
  });

  test("…as does a flick back whose first move goes a pixel left, while the touch may still be a tap", () => {
    const { stage, layer, animations, onCommit } = setup();
    flickRight(stage, layer);
    const before = animations.length;
    const again = press(stage, layer("current"), 400, 200, 200);
    const arriving = animations.slice(before);
    animatedAt([
      [layer("current"), "translateX(-300px)"],
      [layer("next"), "scale(0.9825) translateY(4px)"],
    ]);
    again.move(399, 200);
    for (let i = 1; i <= 8; i++) again.move(399 + 20 * i, 200);
    expect(arriving.map((a) => a.playState)).toEqual(["running", "running"]);
    expect(layer("current").style.transform).toBe("");
    expect(layer("prev").style.visibility).toBe("visible");
    again.up();
    // The first move landed as the touch went down; the second slides the card before in now.
    expect(onCommit).toHaveBeenCalledOnce();
    expect(animations.at(-1)?.el).toBe(layer("prev"));
  });

  test("…and a tap's jitter to the left", () => {
    const { stage, layer, animations, onTap } = setup();
    flickRight(stage, layer);
    const before = animations.length;
    const again = press(stage, layer("current"), 400, 200, 200);
    const arriving = animations.slice(before);
    animatedAt([
      [layer("current"), "translateX(-300px)"],
      [layer("next"), "scale(0.9825) translateY(4px)"],
    ]);
    again.move(399, 200);
    again.up(40);
    expect(onTap).toHaveBeenCalledOnce();
    expect(arriving.map((a) => a.playState)).toEqual(["running", "running"]);
  });

  test("…and, once it has arrived, the next move doesn't make up the drift in a frame: it takes the card from its place", async () => {
    const { stage, layer, animations } = setup();
    flickRight(stage, layer);
    const before = animations.length;
    const again = press(stage, layer("current"), 700, 200, 200);
    const arriving = animations.slice(before);
    for (let x = 699; x >= 692; x--) again.move(x, 200);
    await act(async () => {
      for (const animation of arriving) animation.finish();
    });
    again.move(691, 200);
    expect(layer("current").style.transform).toBe("translateX(0px) rotate(0deg)");
    again.move(690, 200);
    expect(layer("current").style.transform).toBe("translateX(-1px) rotate(-0.03deg)");
  });

  test("…nor does a drag past the slop once it has arrived", async () => {
    const { stage, layer, animations } = setup();
    flickRight(stage, layer);
    const before = animations.length;
    const again = press(stage, layer("current"), 700, 200, 200);
    const arriving = animations.slice(before);
    for (let x = 699; x >= 692; x--) again.move(x, 200);
    await act(async () => {
      for (const animation of arriving) animation.finish();
    });
    again.move(685, 200);
    expect(layer("current").style.transform).toBe("translateX(0px) rotate(0deg)");
    again.move(684, 200);
    expect(layer("current").style.transform).toBe("translateX(-1px) rotate(-0.03deg)");
  });

  test("…which a drag the other way takes hold of where it is, with the card it covers", () => {
    const { stage, layer, animations } = setup();
    flickRight(stage, layer);
    const before = animations.length;
    const again = press(stage, layer("current"), 700, 200, 200);
    const arriving = animations.slice(before);
    // Some way in, the card it covers half settled.
    animatedAt([
      [layer("current"), "translateX(-300px)"],
      [layer("next"), "scale(0.9825) translateY(4px)"],
    ]);
    again.move(680, 200);
    expect(arriving.map((a) => a.playState)).toEqual(["idle", "idle"]);
    expect(layer("current").style.transform).toBe("translateX(-300px) rotate(0deg)");
    expect(layer("next").style.transform).toBe("scale(0.9825) translateY(4px)");
    // It tilts, and the card underneath rises, from there: 33.6 px further is a fifth of the way to a commit.
    again.move(646.4, 200);
    expect(layer("current").style.transform).toBe("translateX(-333.6px) rotate(-1.008deg)");
    expect(layer("next").style.transform).toBe("scale(0.9895) translateY(2.4px)");
  });

  test("…which then leans only as it is dragged on from there: dragged back, it reaches its place upright", () => {
    const { stage, layer } = setup();
    flickRight(stage, layer);
    const again = press(stage, layer("current"), 700, 200, 200);
    animatedAt([
      [layer("current"), "translateX(-300px)"],
      [layer("next"), "scale(0.9825) translateY(4px)"],
    ]);
    again.move(680, 200);
    for (let x = 700; x <= 975; x += 25) again.move(x, 200);
    // 5 px short of its place; the next move brings out the card before, putting this one at rest, upright.
    expect(layer("current").style.transform).toBe("translateX(-5px) rotate(0deg)");
    again.move(990, 200);
    expect(layer("current").style.transform).toBe("");
  });

  test("…as the card it covers goes back into its own place with it", () => {
    const { stage, layer } = setup();
    flickRight(stage, layer);
    const again = press(stage, layer("current"), 700, 200, 200);
    animatedAt([
      [layer("current"), "translateX(-300px)"],
      [layer("next"), "scale(0.9825) translateY(4px)"],
    ]);
    again.move(680, 200);
    // Held at −300 px over a card half risen; dragged back to −60 px, a fifth of that way from its place, the card it
    // covers is a fifth of its way risen: a tenth.
    again.move(920, 200);
    expect(layer("next").style.transform).toBe("scale(0.9685) translateY(7.2px)");
  });

  test("…as a key going on does, flinging it from there", () => {
    const { stage, layer, animations, swipe } = setup();
    flickRight(stage, layer);
    const before = animations.length;
    press(stage, layer("current"), 700, 200, 200).up(400);
    const arriving = animations.slice(before);
    animatedAt([
      [layer("current"), "translateX(-300px)"],
      [layer("next"), "scale(0.9825) translateY(4px)"],
    ]);
    act(() => swipe().commit("next"));
    expect(arriving.map((a) => a.playState)).toEqual(["idle", "idle"]);
    expect(animations.slice(-2).map((a) => a.keyframes[0])).toEqual([
      { transform: "translateX(-300px)" },
      { transform: "scale(0.9825) translateY(4px)" },
    ]);
  });

  test("…and a deal ends", () => {
    const { stage, layer, animations, swipe } = setup();
    flickRight(stage, layer);
    const before = animations.length;
    press(stage, layer("current"), 700, 200, 200).up(400);
    const arriving = animations.slice(before);
    act(() => swipe().deal());
    expect(arriving.map((a) => a.playState)).toEqual(["idle", "idle"]);
  });

  test("…while the next landing covers it, the card it then lies under settling from where it was, not from on top", () => {
    const { stage, layer, animations, swipe } = setup();
    flickRight(stage, layer);
    act(() => swipe().commit("prev"));
    // The first card back still on its way into its place, the card it covers settling into its own.
    animatedAt([
      [layer("current"), "translateX(-160px)"],
      [layer("next"), "scale(0.99) translateY(2px)"],
    ]);
    const before = animations.length;
    act(() => swipe().commit("prev"));
    const settles = animations.slice(before).filter((a) => a.el === layer("next"));
    expect(settles.map((a) => [a.keyframes, a.options])).toEqual([
      [
        [{ transform: "translateX(-160px)" }, { transform: "scale(0.965) translateY(8px)" }],
        { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      ],
    ]);
  });

  test("…over a copy of the card it was covering, which leaves the layers then and goes once it is covered", async () => {
    const { stage, layer, animations, swipe } = setup();
    flickRight(stage, layer);
    act(() => swipe().commit("prev"));
    layer("next").textContent = "the card covered";
    animatedAt([
      [layer("current"), "translateX(-160px)"],
      [layer("next"), "scale(0.99) translateY(2px)"],
    ]);
    act(() => swipe().commit("prev"));
    const copy = layer("next").previousElementSibling;
    if (!(copy instanceof HTMLElement)) throw new Error("no copy under the card settling");
    expect(copy.textContent).toBe("the card covered");
    // Where it was, out of the way: no role for the stage's lookups, no input, nothing read out.
    expect([copy.style.visibility, copy.style.transform]).toEqual(["visible", "scale(0.99) translateY(2px)"]);
    expect(copy.hasAttribute("data-role")).toBe(false);
    expect([copy.inert, copy.getAttribute("aria-hidden")]).toEqual([true, "true"]);
    await act(async () => animations.find((a) => a.el === layer("next"))?.finish());
    expect(copy.isConnected).toBe(false);
  });

  test("…under reduced motion, nothing to settle and nothing copied: the card under it is in its place at once", () => {
    const { stage, layer, swipe } = setup({ reducedMotion: () => true });
    flickRight(stage, layer);
    act(() => swipe().commit("prev"));
    act(() => swipe().commit("prev"));
    expect([...stage.children].filter((el) => !el.hasAttribute("data-role"))).toEqual([]);
  });

  test("under reduced motion the card coming back fades in on, in its place", () => {
    const { stage, layer, animations } = setup({ reducedMotion: () => true });
    flickRight(stage, layer);
    const [fade] = animations;
    if (fade) fade.currentTime = 70;
    press(stage, layer("current"), 700, 200, 200);
    expect(animations.slice(1).map((a) => [a.el, a.keyframes, a.options, a.currentTime])).toEqual([
      [layer("current"), [{ opacity: 0 }, { opacity: 1 }], { duration: 140 }, 70],
    ]);
  });

  test("a pointerdown mid-cancel catches the cards where they are, and the drag goes on from there", () => {
    const { stage, layer, animations } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(650, 200, 50);
    finger.up(100);
    const springs = [...animations];
    // Some way back: 30 of the 50 px to go.
    animatedAt([
      [layer("current"), "translateX(-30px) rotate(-0.9deg)"],
      [layer("next"), "scale(0.9775) translateY(5.143px)"],
    ]);
    const again = press(stage, layer("current"), 700, 200, 140);
    expect(springs.map((a) => a.playState)).toEqual(["idle", "idle"]);
    expect(layer("current").style.transform).toBe("translateX(-30px) rotate(-0.9deg)");
    expect(layer("next").style.transform).toBe("scale(0.9775) translateY(5.143px)");
    again.move(680, 200);
    expect(layer("current").style.transform).toBe("translateX(-50px) rotate(-1.5deg)");
  });

  test("…the previous card too, while any of it shows", () => {
    const { stage, layer } = setup();
    const finger = press(stage, layer("current"), 400, 200);
    finger.move(450, 200, 50);
    finger.up(100);
    // 20 px of it still on screen: it waits at −880 px.
    animatedAt([[layer("prev"), "translateX(-860px)"]]);
    const again = press(stage, layer("current"), 700, 200, 140);
    expect(inline(layer("prev"))).toEqual({ transform: "translateX(-860px)", visibility: "visible" });
    again.move(720, 200);
    expect(layer("prev").style.transform).toBe("translateX(-840px)");
  });

  test("…the first card of a pass too, from where it gives as a rubber band", () => {
    const { stage, layer } = setup({}, { prev: false });
    const finger = press(stage, layer("current"), 400, 200);
    finger.move(480, 200, 50);
    finger.up(100);
    // 20 px out, where a pull of 48.5 px holds it; pulled 10 px further, it gives 22.9 px.
    animatedAt([[layer("current"), "translateX(20px) rotate(0.6deg)"]]);
    press(stage, layer("current"), 700, 200, 140).move(710, 200);
    expect(layer("current").style.transform).toMatch(/^translateX\(22\.94\d*px\)/);
  });

  test("…and should the touch be a tap, the card turns over as they spring back from where they were caught", () => {
    const { stage, layer, animations, onTap } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(650, 200, 50);
    finger.up(100);
    animatedAt([
      [layer("current"), "translateX(-30px) rotate(-0.9deg)"],
      [layer("next"), "scale(0.9775) translateY(5.143px)"],
    ]);
    const before = animations.length;
    press(stage, layer("current"), 700, 200, 140).up(60);
    expect(onTap).toHaveBeenCalledOnce();
    expect(animations.slice(before).map((a) => [a.el, a.keyframes])).toEqual([
      [
        layer("current"),
        [{ transform: "translateX(-30px) rotate(-0.9deg)" }, { transform: "translateX(0px) rotate(0deg)" }],
      ],
      [
        layer("next"),
        [{ transform: "scale(0.9775) translateY(5.143px)" }, { transform: "scale(0.965) translateY(8px)" }],
      ],
    ]);
  });

  test("a touch off the card mid-cancel finishes it", () => {
    const { stage, layer, animations } = setup();
    const finger = press(stage, layer("current"), 400, 200);
    finger.move(450, 200, 50);
    finger.up(100);
    press(stage, stage, 100, 200, 200);
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

describe("starting", () => {
  // The document's timeline reads the last frame's time.
  beforeEach(() => {
    vi.spyOn(document.timeline, "currentTime", "get").mockReturnValue(1000);
  });

  test("a move carries on from the release at once: it starts at the timeline's time, not on the next frame", () => {
    const { stage, layer, animations, swipe } = setup();
    flick(stage, layer);
    act(() => swipe().commit("next"));
    act(() => swipe().commit("prev"));
    // The fling and the rise; a copy flying on, the key's fling and rise; a copy flying on, the slide in.
    expect(animations.map((a) => a.startTime)).toEqual([1000, 1000, 1000, 1000, 1000, 1000, 1000]);
  });

  test("so does a cancel's spring back", () => {
    const { stage, layer, animations } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(650, 200, 50);
    finger.up(100);
    expect(animations.map((a) => a.startTime)).toEqual([1000, 1000]);
  });

  test("a deal waits for the next frame, so it starts from its first keyframe: after a render, the timeline's time can be frames old", () => {
    const { animations, swipe } = setup();
    act(() => swipe().deal());
    expect(animations.map((a) => a.startTime)).toEqual([null, null]);
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
    flickRight(stage, layer);
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

describe("tap() and reshuffle(), for keys and buttons", () => {
  test("tap() completes a running commit first, so the card that lands is the one that flips", () => {
    const { onTap, onCommit, swipe } = setup();
    act(() => swipe().commit("next"));
    act(() => swipe().tap());
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onTap).toHaveBeenCalledOnce();
    expect(onCommit.mock.invocationCallOrder[0]).toBeLessThan(onTap.mock.invocationCallOrder[0] ?? 0);
  });

  test("reshuffle() does too, so it goes by the card that lands", () => {
    const { onReshuffle, onCommit, swipe } = setup();
    act(() => swipe().commit("prev"));
    act(() => swipe().reshuffle());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("prev");
    expect(onReshuffle).toHaveBeenCalledOnce();
    expect(onCommit.mock.invocationCallOrder[0]).toBeLessThan(onReshuffle.mock.invocationCallOrder[0] ?? 0);
  });

  test("neither does anything while a finger is down: the card under it is the finger's", () => {
    const { stage, layer, onTap, onReshuffle, swipe } = setup();
    press(stage, layer("current"), 700, 200).move(650, 200);
    act(() => swipe().tap());
    act(() => swipe().reshuffle());
    expect(onTap).not.toHaveBeenCalled();
    expect(onReshuffle).not.toHaveBeenCalled();
  });
});

describe("deal(), when the view brings a new card", () => {
  const timing = { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" };

  test("the card on top rises 14 px as it fades in", () => {
    const { layer, animations, swipe } = setup();
    act(() => swipe().deal());
    expect(animations.filter((a) => a.el === layer("current")).map((a) => [a.keyframes, a.options])).toEqual([
      [
        [
          { transform: "translateY(14px)", opacity: 0 },
          { transform: "translateY(0px)", opacity: 1 },
        ],
        timing,
      ],
    ]);
  });

  test("the card underneath settles under it, from where the card on top was to its own place", () => {
    const { layer, animations, swipe } = setup();
    act(() => swipe().deal());
    expect(animations.filter((a) => a.el === layer("next")).map((a) => [a.keyframes, a.options])).toEqual([
      [[{ transform: "scale(1) translateY(0px)" }, { transform: "scale(0.965) translateY(8px)" }], timing],
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
    await act(async () => {
      for (const animation of animations) animation.finish();
    });
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

// The pages of a back: the card is 360 px tall, so a sheet peeks 12 px (12 of 360 card units), 28 % is 100.8 px, and
// a sheet is gone 12 px past the card's edge, at ±372 px.
describe("pages", () => {
  // Finishing settles `finished` a microtask later, and the commit follows it.
  const finish = (animations: FakeAnimation[]) =>
    act(async () => {
      for (const a of animations) a.finish();
    });

  test("a vertical drag on a paged back moves the sheet with the finger past the slop, the next sheet rising from its peek", () => {
    const { stage, layer, sheet, renders } = setup({}, { pages: 3 });
    const before = renders();
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(702, 150);
    expect(sheet(0).style.transform).toBe("translateY(-50px)");
    expect(sheet(1).style.transform).toBe("translateY(10.3333px)");
    finger.move(702, 20);
    expect(sheet(0).style.transform).toBe("translateY(-180px)");
    expect(sheet(1).style.transform).toBe("translateY(6px)");
    expect(layer("current").style.transform, "the card itself stays").toBe("");
    expect(renders()).toBe(before);
  });

  test("let go past 28 % of the height, the page turns: onPage now, the sheets fly on, then onPageCommit and nothing inline", async () => {
    const { stage, layer, sheet, animations, onPage, onPageCommit, onDecide } = setup({}, { pages: 3 });
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(700, 80);
    const [first, second] = [sheet(0), sheet(1)];
    finger.up();
    expect(onPage).toHaveBeenCalledWith("next");
    expect(onDecide).not.toHaveBeenCalled();
    expect(onPageCommit).not.toHaveBeenCalled();
    expect(animations.map((a) => [a.el === first, a.el === second, a.keyframes, a.options.fill])).toEqual([
      [true, false, [{ transform: "translateY(-120px)" }, { transform: "translateY(-372px)" }], "forwards"],
      [false, true, [{ transform: "translateY(8px)" }, { transform: "translateY(0px)" }], "forwards"],
    ]);

    await finish(animations.slice(0, 2));

    expect(onPageCommit).toHaveBeenCalledWith("next");
    expect(animations.slice(0, 2).map((a) => a.playState)).toEqual(["idle", "idle"]);
    expect([inline(first).transform, inline(second).transform]).toEqual(["", ""]);
    // The sheet that was shown is now the one before, and settles from where it flew into its peek at the head.
    expect(first.dataset.pos).toBe("prev");
    expect(animations[2]?.el).toBe(first);
    expect(animations[2]?.keyframes).toEqual([{ transform: "translateY(-372px)" }, { transform: "translateY(-12px)" }]);
    expect(animations[2]?.options.duration).toBe(260);
  });

  test("a drag down from a later page brings the page before down into place", async () => {
    const { stage, layer, sheet, animations, onPage, onPageCommit, swipe } = setup({}, { pages: 3 });
    act(() => swipe().page("next"));
    await finish(animations.splice(0));
    expect(onPageCommit).toHaveBeenCalledWith("next");
    animations.splice(0);

    const finger = press(stage, layer("current"), 700, 100);
    finger.move(700, 190);
    expect(sheet(1).style.transform).toBe("translateY(90px)");
    expect(sheet(0).style.transform).toBe("translateY(-9px)");
    finger.move(700, 220);
    finger.up();
    expect(onPage).toHaveBeenLastCalledWith("prev");
    expect(animations[0]?.keyframes).toEqual([{ transform: "translateY(120px)" }, { transform: "translateY(372px)" }]);
  });

  test("let go short of the threshold, the sheets spring back on the cancel timing, and no page is turned", () => {
    const { stage, layer, sheet, animations, onPage } = setup({}, { pages: 3 });
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(700, 150, 300);
    finger.up(100);
    expect(onPage).not.toHaveBeenCalled();
    expect(animations.map((a) => [a.el === sheet(0), a.el === sheet(1), a.keyframes, a.options])).toEqual([
      [
        true,
        false,
        [{ transform: "translateY(-50px)" }, { transform: "translateY(0px)" }],
        { duration: 260, easing: "cubic-bezier(0.3, 1.25, 0.5, 1)" },
      ],
      [
        false,
        true,
        [{ transform: "translateY(10.3333px)" }, { transform: "translateY(12px)" }],
        { duration: 260, easing: "cubic-bezier(0.3, 1.25, 0.5, 1)" },
      ],
    ]);
    expect([inline(sheet(0)).transform, inline(sheet(1)).transform]).toEqual(["", ""]);
  });

  test("on the last page a drag up gives, rubber-banded, and springs back", async () => {
    const { stage, layer, sheet, animations, onPage, swipe } = setup({}, { pages: 2 });
    act(() => swipe().page("next"));
    await finish(animations.splice(0));
    animations.splice(0);
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(700, 150);
    expect(sheet(1).style.transform).toBe("translateY(-20.4651px)");
    finger.move(700, 20);
    finger.up();
    expect(onPage).toHaveBeenCalledTimes(1);
    expect(animations[0]?.keyframes[1]).toEqual({ transform: "translateY(0px)" });
  });

  test("page(dir) turns from rest on the commit easing: onPage, the turn, onPageCommit", async () => {
    const { sheet, animations, onPage, onPageCommit, swipe } = setup({}, { pages: 3 });
    act(() => swipe().page("next"));
    expect(onPage).toHaveBeenCalledWith("next");
    expect(animations[0]?.el).toBe(sheet(0));
    expect(animations[0]?.keyframes).toEqual([{ transform: "translateY(0px)" }, { transform: "translateY(-372px)" }]);
    expect(animations[0]?.options).toMatchObject({ easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "forwards" });
    expect(animations[1]?.keyframes).toEqual([{ transform: "translateY(12px)" }, { transform: "translateY(0px)" }]);
    await finish(animations.slice(0, 2));
    expect(onPageCommit).toHaveBeenCalledWith("next");
  });

  test("page(dir) does nothing without a page that way, nor while a pointer is down", () => {
    const { stage, layer, onPage, swipe } = setup({}, { pages: 3 });
    act(() => swipe().page("prev"));
    expect(onPage).not.toHaveBeenCalled();
    press(stage, layer("current"), 700, 200);
    act(() => swipe().page("next"));
    expect(onPage).not.toHaveBeenCalled();
  });

  test("under reduced motion the next sheet is written in place and the page shown fades out", () => {
    const { stage, layer, sheet, animations } = setup({ reducedMotion: () => true }, { pages: 3 });
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(700, 80);
    finger.up();
    expect(sheet(1).style.transform).toBe("translateY(0px)");
    expect(animations.map((a) => [a.el === sheet(0), a.keyframes])).toEqual([[true, [{ opacity: 1 }, { opacity: 0 }]]]);
  });

  test("without pages a vertical drag puts the card back, as it did", () => {
    const { stage, layer, onPage, animations } = setup();
    const finger = press(stage, layer("current"), 700, 200);
    finger.move(700, 100);
    finger.up();
    expect(onPage).not.toHaveBeenCalled();
    expect(animations).toEqual([]);
    expect(inline(layer("current")).transform).toBe("");
  });
});
