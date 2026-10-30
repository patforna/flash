// Test support for the gesture and the stage: a recording stand-in for Web Animations, and pointers with timestamps.
import { act } from "@testing-library/react";

// Records what was animated; finish() and cancel() settle `finished` as browsers do (cancel rejects it).
export class FakeAnimation {
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

// A finger (or mouse) going down on `target` at (x, y) at time `t` ms; later events go to the stage, as captured.
// A move can carry the samples the browser coalesced into it (the move's own position last).
export function press(stage: HTMLElement, target: Element, x: number, y: number, t = 0, init: PointerEventInit = {}) {
  let now = { x, y, t };
  const fire = (type: string, el: Element, coalesced: { x: number; t: number }[] = []) =>
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
      const samples = coalesced.map((c) => ({ clientX: c.x, clientY: now.y, timeStamp: c.t }));
      if (samples.length) Object.defineProperty(event, "getCoalescedEvents", { value: () => samples });
      el.dispatchEvent(event);
    });
  fire("pointerdown", target);
  return {
    move(mx: number, my: number, dt = 8, coalesced: { x: number; t: number }[] = []) {
      now = { x: mx, y: my, t: now.t + dt };
      fire("pointermove", stage, coalesced);
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

// What a gesture writes inline on a layer.
export const inline = (el: HTMLElement) => ({ transform: el.style.transform, visibility: el.style.visibility });
