// To do:
// [ ] a tap calls onTap; a long hold doesn't; never after a drag
// [ ] a horizontal drag writes translate and rotate on the current layer
// [ ] the card underneath scales and rises with progress
// [ ] a right drag shows the previous layer, following from −(cardRect.right + 80)
// [ ] a right drag without a previous card rubber-bands the current one
// [ ] zero React commits during a drag
// [ ] a release past the threshold flings at the release speed (fill: forwards only here); the card underneath rises
// [ ] onCommit once the fling finishes; then the fling is cancelled and inline styles cleared
// [ ] a commit to the previous card slides it in to 0
// [ ] a cancel animates back with the cancel timing and leaves nothing filling
// [ ] a vertical drag and a pointercancel do nothing; a pointercancel mid-drag cancels
// [ ] only the first pointer counts; a pointer that went down off the card, on a button or with another button is ignored
// [ ] a pointerdown during a commit finishes it, completing the commit (flushSync) before reading layers() again
// [ ] a pointerdown during a cancel or a deal finishes it
// [ ] reduced motion: no rotation while following; opacity-only animations
// [ ] commit(dir): the same fling from rest on MOTION.commitEase; not where can() forbids, nor while a pointer is down
// [ ] tap(): completes a running commit, then onTap
// [ ] deal(): drops a running commit; translateY(14px) → 0 and opacity 0 → 1 over 220 ms
// [ ] a horizontal drag finishes a running flip
import { act, render } from "@testing-library/react";
import { Profiler, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type SwipeOptions, useSwipe } from "./useSwipe";

// The card: 600 × 360 at (280, 24). 28 % of it is 168 px; off screen to the left is −(880 + 80) = −960 px.
const card = { x: 280, y: 24, left: 280, top: 24, right: 880, bottom: 384, width: 600, height: 360 };

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(card as DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Records what was animated; finish() and cancel() settle `finished` as browsers do (cancel rejects it).
class FakeAnimation {
  playState: AnimationPlayState = "running";
  readonly finished: Promise<FakeAnimation>;
  #resolve: (a: FakeAnimation) => void = () => {};
  #reject: (e: unknown) => void = () => {};

  constructor(
    readonly el: Element,
    readonly keyframes: Keyframe[],
    readonly options: KeyframeAnimationOptions,
  ) {
    this.finished = new Promise((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
    this.finished.catch(() => {});
  }

  finish() {
    if (this.playState !== "running") return;
    this.playState = "finished";
    this.#resolve(this);
  }

  cancel() {
    if (this.playState === "running") this.#reject(new DOMException("The animation was cancelled", "AbortError"));
    this.playState = "idle";
  }
}

// A stage with real layer elements. Each commit brings new ones, as a new card would.
function Stage({ options, prev }: { options: SwipeOptions; prev: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const [commits, setCommits] = useState(0);
  useSwipe(stage, {
    ...options,
    layers: () => {
      const find = (role: string) => stage.current?.querySelector<HTMLElement>(`[data-role="${role}"]`) ?? null;
      const current = find("current");
      return current && { current, next: find("next"), prev: prev ? find("prev") : null };
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

function setup(overrides: Partial<SwipeOptions> = {}, { prev = true } = {}) {
  const animations: FakeAnimation[] = [];
  const options: SwipeOptions = {
    layers: () => null,
    can: () => ({ prev: true, next: true }),
    onTap: vi.fn(),
    onCommit: vi.fn(),
    reducedMotion: () => false,
    animate: (el, keyframes, opts) => {
      const animation = new FakeAnimation(el, keyframes, opts);
      animations.push(animation);
      return animation as unknown as Animation;
    },
    ...overrides,
  };
  let renders = 0;
  const view = render(
    <Profiler id="stage" onRender={() => renders++}>
      <Stage options={options} prev={prev} />
    </Profiler>,
  );
  const stage = view.getByTestId("stage");
  const layer = (role: string) => {
    const el = stage.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (!el) throw new Error(`no ${role} layer`);
    return el;
  };
  return { stage, layer, animations, onTap: options.onTap, onCommit: options.onCommit, renders: () => renders };
}

// A finger (or mouse) going down on `target` at (x, y) at time `t` ms; later events go to the stage, as captured.
function press(stage: HTMLElement, target: Element, x: number, y: number, t = 0, init: PointerEventInit = {}) {
  let now = { x, y, t };
  const fire = (type: string, el: Element) =>
    act(() => {
      const event = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: now.x,
        clientY: now.y,
        pointerId: 1,
        isPrimary: true,
        pointerType: "touch",
        ...init,
      });
      Object.defineProperty(event, "timeStamp", { value: now.t });
      el.dispatchEvent(event);
    });
  fire("pointerdown", target);
  return {
    move(mx: number, my: number, dt = 8) {
      now = { x: mx, y: my, t: now.t + dt };
      fire("pointermove", stage);
    },
    up(dt = 0) {
      now = { ...now, t: now.t + dt };
      fire("pointerup", stage);
    },
    cancel() {
      fire("pointercancel", stage);
    },
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
    expect(layer("prev").style.transform).toBe("translateX(-910px)");
    finger.move(600, 200);
    expect(layer("prev").style.transform).toBe("translateX(-760px)");
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

  test("with no previous card, a right drag only gives a little, like a rubber band", () => {
    const { stage, layer } = setup({}, { prev: false });
    const finger = press(stage, layer("current"), 400, 200);
    finger.move(480, 200);
    expect(layer("current").style.transform).toBe("translateX(28.3871px) rotate(0.8516deg)");
    expect(layer("next").style.transform).toBe("");
  });
});

const inline = (el: HTMLElement) => ({ transform: el.style.transform, visibility: el.style.visibility });

// A drag left at 2.5 px/ms to dx −160 (short of 168 px, but fast): the fling has 800 px to go.
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
      { transform: "translateX(-960px) rotate(-10deg)" },
    ]);
    expect(fling?.options).toEqual({ duration: 320, easing: "cubic-bezier(0.2, 0.2, 0.3, 1)", fill: "forwards" });
    expect(rise?.el).toBe(layer("next"));
    expect(rise?.keyframes).toEqual([
      { transform: "scale(0.9983) translateY(0.381px)" },
      { transform: "scale(1) translateY(0px)" },
    ]);
    expect(rise?.options).toEqual({ duration: 320, easing: "cubic-bezier(0.2, 0.2, 0.3, 1)" });
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

  test("a flick right slides the previous card in to its place, then commits", async () => {
    const { stage, layer, animations, onCommit } = setup();
    const finger = press(stage, layer("current"), 400, 200);
    for (let i = 1; i <= 8; i++) finger.move(400 + 20 * i, 200);
    finger.up();
    const [slide] = animations;
    expect(slide?.el).toBe(layer("prev"));
    expect(slide?.keyframes).toEqual([{ transform: "translateX(-800px)" }, { transform: "translateX(0px)" }]);
    expect(slide?.options).toEqual({ duration: 320, easing: "cubic-bezier(0.2, 0.2, 0.3, 1)", fill: "forwards" });
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
      [prev, [{ transform: "translateX(-910px)" }, { transform: "translateX(-960px)" }], cancel],
    ]);
    expect(inline(prev)).toEqual({ transform: "translateX(-960px)", visibility: "visible" });
    await act(async () => animations[0]?.finish());
    expect(inline(prev)).toEqual({ transform: "", visibility: "" });
  });
});
