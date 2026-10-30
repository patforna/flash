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
import { useRef, useState } from "react";
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

function setup(options: Partial<SwipeOptions> = {}) {
  const animations: FakeAnimation[] = [];
  const onTap = vi.fn();
  const onCommit = vi.fn();

  function Stage() {
    const stage = useRef<HTMLDivElement>(null);
    const [commits, setCommits] = useState(0);
    useSwipe(stage, {
      layers: () => {
        const find = (role: string) => stage.current?.querySelector<HTMLElement>(`[data-role="${role}"]`) ?? null;
        const current = find("current");
        return current && { current, next: find("next"), prev: find("prev") };
      },
      can: () => ({ prev: true, next: true }),
      onTap,
      onCommit: (dir) => {
        onCommit(dir);
        setCommits((n) => n + 1);
      },
      reducedMotion: () => false,
      animate: (el, keyframes, opts) => {
        const animation = new FakeAnimation(el, keyframes, opts);
        animations.push(animation);
        return animation as unknown as Animation;
      },
      ...options,
    });
    // Each commit brings new layer elements, as a new card would.
    return (
      <div ref={stage} data-testid="stage">
        {(["next", "current", "prev"] as const).map((role) => (
          <div key={`${role}-${commits}`} data-role={role} />
        ))}
      </div>
    );
  }

  const view = render(<Stage />);
  const stage = view.getByTestId("stage");
  const layer = (role: string) => {
    const el = stage.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (!el) throw new Error(`no ${role} layer`);
    return el;
  };
  return { stage, layer, animations, onTap, onCommit };
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
});
