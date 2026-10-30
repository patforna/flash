import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { flingDuration, flingEasing } from "../motion/timing";
import { classify, GESTURE, isTap, release, rubberBand, type Sample, velocityX } from "./gesture";

export interface SwipeOptions {
  layers(): { current: HTMLElement; next: HTMLElement | null; prev: HTMLElement | null } | null;
  can(): { prev: boolean; next: boolean };
  onTap(): void;
  onCommit(dir: "next" | "prev"): void; // after the animation finishes
  reducedMotion(): boolean;
  animate?: (el: Element, k: Keyframe[], o: KeyframeAnimationOptions) => Animation; // injectable
}

type Dir = "next" | "prev";
type Layers = NonNullable<ReturnType<SwipeOptions["layers"]>>;

interface Gesture {
  start: Sample;
  samples: Sample[];
  axis: "pending" | "horizontal" | "vertical";
  layers: Layers;
  rect: DOMRect; // the current card at pointerdown, in viewport px
}

// Animations in flight; a commit's carries its direction.
interface Run {
  animations: Animation[];
  dir: Dir | null;
}

const FLING_TILT = 10; // degrees, as a flung card leaves

const sample = (e: PointerEvent): Sample => ({ t: e.timeStamp, x: e.clientX, y: e.clientY });
const tilt = (dx: number) => Math.min(GESTURE.tiltMax, Math.max(-GESTURE.tiltMax, dx * GESTURE.tiltPerPx));
const fixed = (n: number) => Math.round(n * 1e4) / 1e4;
// Where a card rests once it has gone, 80 px past the screen's left edge, and where the previous card comes back from.
const gone = (card: DOMRect) => -(card.right + 80);
// The card underneath, from resting (p = 0) to in place (p = 1).
const underneath = (p: number) => `scale(${fixed(0.965 + 0.035 * p)}) translateY(${fixed(8 * (1 - p))}px)`;

function swipe(stage: RefObject<HTMLElement | null>, options: RefObject<SwipeOptions>) {
  let gesture: Gesture | null = null;
  let running: Run | null = null;
  let settling: Run | null = null;
  const touched = new Set<HTMLElement>();

  const write = (el: HTMLElement, transform: string) => {
    el.style.transform = transform;
    touched.add(el);
  };
  const animate = (el: Element, keyframes: Keyframe[], timing: KeyframeAnimationOptions) =>
    (options.current.animate ?? ((target, k, o) => target.animate(k, o)))(el, keyframes, timing);

  function play(animations: Animation[], dir: Dir | null) {
    const run: Run = { animations, dir };
    running = run;
    Promise.all(animations.map((a) => a.finished)).then(
      () => complete(run),
      () => {},
    );
  }

  function complete(run: Run) {
    if (running !== run || !run.dir) return;
    const dir = run.dir;
    running = null;
    settling = run;
    flushSync(() => options.current.onCommit(dir));
  }

  // After the commit has rendered, before paint: let go of the fling and clear every inline style written.
  function settle() {
    if (!settling) return;
    for (const animation of settling.animations) animation.cancel();
    settling = null;
    for (const el of touched) {
      el.style.removeProperty("transform");
      el.style.removeProperty("visibility");
    }
    touched.clear();
  }

  function follow(g: Gesture, dx: number) {
    const { layers, rect } = g;
    if (dx > 0 && layers.prev) {
      layers.prev.style.visibility = "visible";
      write(layers.prev, `translateX(${gone(rect) + dx}px)`);
      return;
    }
    const x = dx > 0 ? rubberBand(dx) : dx;
    write(layers.current, `translateX(${fixed(x)}px) rotate(${fixed(tilt(x))}deg)`);
    if (layers.next && dx < 0) write(layers.next, underneath(Math.min(-dx / rect.width / GESTURE.commitFraction, 1)));
  }

  function fling(g: Gesture, dx: number, vx: number) {
    const { current, next } = g.layers;
    const to = gone(g.rect);
    const timing = { duration: flingDuration(dx - to, vx), easing: flingEasing(dx - to, vx) };
    const animations = [
      animate(
        current,
        [{ transform: current.style.transform }, { transform: `translateX(${to}px) rotate(${-FLING_TILT}deg)` }],
        { ...timing, fill: "forwards" },
      ),
    ];
    if (next) {
      const from = next.style.transform;
      write(next, underneath(1));
      animations.push(animate(next, [{ transform: from }, { transform: underneath(1) }], timing));
    }
    play(animations, "next");
  }

  function slideIn(g: Gesture, dx: number, vx: number) {
    const { prev } = g.layers;
    if (!prev) return;
    const from = gone(g.rect) + dx;
    const timing = { duration: flingDuration(-from, vx), easing: flingEasing(-from, vx) };
    play(
      [
        animate(prev, [{ transform: prev.style.transform }, { transform: "translateX(0px)" }], {
          ...timing,
          fill: "forwards",
        }),
      ],
      "prev",
    );
  }

  const down = (e: PointerEvent) => {
    const layers = options.current.layers();
    if (!layers) return;
    const start = sample(e);
    gesture = { start, samples: [start], axis: "pending", layers, rect: layers.current.getBoundingClientRect() };
  };

  const move = (e: PointerEvent) => {
    if (!gesture) return;
    gesture.samples.push(sample(e));
    if (gesture.axis === "pending") gesture.axis = classify(gesture.start, sample(e));
    if (gesture.axis === "horizontal") follow(gesture, e.clientX - gesture.start.x);
  };

  const up = (e: PointerEvent) => {
    const g = gesture;
    gesture = null;
    if (g?.axis === "pending" && isTap(g.start, sample(e))) options.current.onTap();
    if (g?.axis !== "horizontal") return;
    g.samples.push(sample(e));
    const dx = e.clientX - g.start.x;
    const vx = velocityX(g.samples);
    const decision = release(dx, vx, g.rect.width, options.current.can());
    if (decision === "next") fling(g, dx, vx);
    if (decision === "prev") slideIn(g, dx, vx);
  };

  function listen() {
    const el = stage.current;
    if (!el) return;
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
  }

  return { listen, settle };
}

export function useSwipe(
  stage: RefObject<HTMLElement | null>,
  o: SwipeOptions,
): { commit(dir: "next" | "prev"): void } {
  const options = useRef(o);
  useLayoutEffect(() => {
    options.current = o;
  });
  const [machine] = useState(() => swipe(stage, options));
  useEffect(() => machine.listen(), [machine]);
  useLayoutEffect(() => {
    machine.settle();
  });
  return { commit() {} };
}
