import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { flingDuration, flingEasing, MOTION } from "../motion/timing";
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
  pointer: number;
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
const IN_PLACE = "translateX(0px) rotate(0deg)"; // the card on top at rest, spelt out for keyframes

const sample = (e: PointerEvent): Sample => ({ t: e.timeStamp, x: e.clientX, y: e.clientY });
const tilt = (dx: number) => Math.min(GESTURE.tiltMax, Math.max(-GESTURE.tiltMax, dx * GESTURE.tiltPerPx));
const fixed = (n: number) => Math.round(n * 1e4) / 1e4;
// Back to the resting style of its role, from the stylesheet.
const rest = (el: HTMLElement) => {
  el.style.removeProperty("transform");
  el.style.removeProperty("visibility");
};
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
  // The previous card rests hidden; it shows while it comes back.
  const show = (el: HTMLElement) => {
    el.style.visibility = "visible";
    touched.add(el);
  };
  // The stage's data-state, for styles (will-change only while dragging) and for whoever waits for it to settle.
  const mark = (state: "idle" | "dragging" | "animating") => {
    if (stage.current) stage.current.dataset.state = state;
  };
  const animate = (el: Element, keyframes: Keyframe[], timing: KeyframeAnimationOptions) =>
    (options.current.animate ?? ((target, k, o) => target.animate(k, o)))(el, keyframes, timing);

  function play(animations: Animation[], dir: Dir | null) {
    const run: Run = { animations, dir };
    running = run;
    mark("animating");
    Promise.all(animations.map((a) => a.finished)).then(
      () => complete(run),
      () => {},
    );
  }

  // Input never waits for an animation: it ends now and its commit completes before anything reads the layers again.
  // (finish() alone would settle `finished` a microtask later.)
  function finishRunning() {
    const run = running;
    if (!run) return;
    for (const animation of run.animations) animation.finish();
    complete(run);
  }

  // A new card came from elsewhere (a reshuffle, a topic change): what was in flight belongs to the old one.
  function abort() {
    for (const animation of running?.animations ?? []) animation.cancel();
    running = null;
    mark("idle");
    clear();
  }

  function complete(run: Run) {
    if (running !== run) return;
    running = null;
    mark("idle");
    const { dir } = run;
    if (!dir) return clear();
    settling = run;
    flushSync(() => options.current.onCommit(dir));
  }

  // After the commit has rendered, before paint: let go of the fling and clear every inline style written.
  function settle() {
    if (!settling) return;
    for (const animation of settling.animations) animation.cancel();
    settling = null;
    clear();
  }

  function clear() {
    for (const el of touched) rest(el);
    touched.clear();
  }

  function follow(g: Gesture, dx: number) {
    const { layers, rect } = g;
    if (dx > 0 && layers.prev) {
      rest(layers.current);
      if (layers.next) rest(layers.next);
      show(layers.prev);
      write(layers.prev, `translateX(${gone(rect) + dx}px)`);
      return;
    }
    if (layers.prev) rest(layers.prev);
    const x = dx > 0 ? rubberBand(dx) : dx;
    const deg = options.current.reducedMotion() ? 0 : tilt(x);
    write(layers.current, `translateX(${fixed(x)}px) rotate(${fixed(deg)}deg)`);
    if (layers.next && dx < 0) write(layers.next, underneath(Math.min(-dx / rect.width / GESTURE.commitFraction, 1)));
  }

  // A commit's motion, from a release at dx and vx, or from rest for a key or a button (easing given).
  function fling(layers: Layers, rect: DOMRect, dx: number, vx: number, easing?: string) {
    const { current, next } = layers;
    if (options.current.reducedMotion()) {
      if (next) write(next, underneath(1));
      const fade = animate(current, [{ opacity: 1 }, { opacity: 0 }], { duration: MOTION.fadeMs, fill: "forwards" });
      return play([fade], "next");
    }
    const to = gone(rect);
    const timing = { duration: flingDuration(dx - to, vx), easing: easing ?? flingEasing(dx - to, vx) };
    const from = current.style.transform || IN_PLACE;
    const animations = [
      animate(current, [{ transform: from }, { transform: `translateX(${to}px) rotate(${-FLING_TILT}deg)` }], {
        ...timing,
        fill: "forwards",
      }),
    ];
    if (next) {
      const below = next.style.transform || underneath(0);
      write(next, underneath(1));
      animations.push(animate(next, [{ transform: below }, { transform: underneath(1) }], timing));
    }
    play(animations, "next");
  }

  function slideIn(layers: Layers, rect: DOMRect, dx: number, vx: number, easing?: string) {
    const { prev } = layers;
    if (!prev) return;
    show(prev);
    if (options.current.reducedMotion()) {
      write(prev, "translateX(0px)");
      const fade = animate(prev, [{ opacity: 0 }, { opacity: 1 }], { duration: MOTION.fadeMs, fill: "forwards" });
      return play([fade], "prev");
    }
    const from = gone(rect) + dx;
    const timing = { duration: flingDuration(-from, vx), easing: easing ?? flingEasing(-from, vx) };
    const at = prev.style.transform || `translateX(${from}px)`;
    play(
      [
        animate(prev, [{ transform: at }, { transform: "translateX(0px)" }], {
          ...timing,
          fill: "forwards",
        }),
      ],
      "prev",
    );
  }

  function commit(dir: Dir) {
    if (gesture) return;
    finishRunning();
    const layers = options.current.layers();
    if (!layers || !options.current.can()[dir]) return;
    const rect = layers.current.getBoundingClientRect();
    (dir === "next" ? fling : slideIn)(layers, rect, 0, 0, MOTION.commitEase);
  }

  // Each moved card animates from where it is to its resting style, which it has again as soon as this starts.
  function springBack(g: Gesture) {
    if (options.current.reducedMotion()) return clear();
    const timing = { duration: MOTION.cancelMs, easing: MOTION.cancelEase };
    const animations: Animation[] = [];
    for (const [el, home] of [
      [g.layers.current, IN_PLACE],
      [g.layers.next, underneath(0)],
    ] as const) {
      const from = el?.style.transform;
      if (!el || !from) continue;
      rest(el);
      animations.push(animate(el, [{ transform: from }, { transform: home }], timing));
    }
    const { prev } = g.layers;
    if (prev?.style.visibility === "visible") {
      // Its resting style is hidden, so it ends off screen, still visible, until the run completes.
      const from = prev.style.transform;
      write(prev, `translateX(${gone(g.rect)}px)`);
      animations.push(animate(prev, [{ transform: from }, { transform: prev.style.transform }], timing));
    }
    play(animations, null);
  }

  // The gesture this event belongs to: only the first pointer counts.
  const own = (e: PointerEvent) => (gesture?.pointer === e.pointerId ? gesture : null);

  const down = (e: PointerEvent) => {
    if (gesture || e.button !== 0) return;
    finishRunning();
    if (e.target instanceof Element && e.target.closest("button")) return;
    const layers = options.current.layers();
    if (!layers) return;
    const start = sample(e);
    const rect = layers.current.getBoundingClientRect();
    const onCard = start.x >= rect.left && start.x <= rect.right && start.y >= rect.top && start.y <= rect.bottom;
    if (!onCard) return;
    gesture = { pointer: e.pointerId, start, samples: [start], axis: "pending", layers, rect };
    stage.current?.setPointerCapture(e.pointerId);
    // The card is picked up: its lift rises (the stylesheets key off data-pressed), never the layer that drags.
    layers.current.setAttribute("data-pressed", "");
  };

  // The pointer is done with: the card is put down, and the stage idle until an animation starts.
  const end = (g: Gesture) => {
    gesture = null;
    g.layers.current.removeAttribute("data-pressed");
    mark("idle");
  };

  const move = (e: PointerEvent) => {
    const g = own(e);
    if (!g) return;
    g.samples.push(sample(e));
    if (g.axis === "pending") {
      g.axis = classify(g.start, sample(e));
      // A card dragged mid-flip would travel edge-on: the flip (the card's [data-side] transition) ends now.
      if (g.axis === "horizontal") {
        mark("dragging");
        for (const turning of g.layers.current.querySelector("[data-side]")?.getAnimations({ subtree: true }) ?? []) {
          turning.finish();
        }
      }
    }
    if (g.axis === "horizontal") follow(g, e.clientX - g.start.x);
  };

  const up = (e: PointerEvent) => {
    const g = own(e);
    if (!g) return;
    end(g);
    if (g.axis === "pending" && isTap(g.start, sample(e))) options.current.onTap();
    if (g.axis !== "horizontal") return;
    g.samples.push(sample(e));
    const dx = e.clientX - g.start.x;
    const vx = velocityX(g.samples);
    const decision = release(dx, vx, g.rect.width, options.current.can());
    if (decision === "next") fling(g.layers, g.rect, dx, vx);
    if (decision === "prev") slideIn(g.layers, g.rect, dx, vx);
    if (decision === "cancel") springBack(g);
  };

  // The browser took the pointer (a scroll, a system gesture): whatever moved goes back.
  const cancel = (e: PointerEvent) => {
    const g = own(e);
    if (!g) return;
    end(g);
    if (g.axis === "horizontal") springBack(g);
  };

  function listen() {
    const el = stage.current;
    if (!el) return;
    mark("idle");
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
    };
  }

  function tap() {
    finishRunning();
    options.current.onTap();
  }

  function deal() {
    if (gesture) return;
    abort();
    const layers = options.current.layers();
    if (!layers) return;
    const fade = options.current.reducedMotion();
    const keyframes = fade
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { transform: "translateY(14px)", opacity: 0 },
          { transform: "translateY(0px)", opacity: 1 },
        ];
    const timing = fade ? { duration: MOTION.fadeMs } : { duration: MOTION.dealMs, easing: MOTION.dealEase };
    play([animate(layers.current, keyframes, timing)], null);
  }

  return { listen, settle, commit, tap, deal };
}

export function useSwipe(
  stage: RefObject<HTMLElement | null>,
  o: SwipeOptions,
): { commit(dir: "next" | "prev"): void; tap(): void; deal(): void } {
  const options = useRef(o);
  useLayoutEffect(() => {
    options.current = o;
  });
  const [machine] = useState(() => swipe(stage, options));
  useEffect(() => machine.listen(), [machine]);
  useLayoutEffect(() => {
    machine.settle();
  });
  return { commit: machine.commit, tap: machine.tap, deal: machine.deal };
}
