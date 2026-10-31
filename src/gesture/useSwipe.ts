import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { flingDuration, flingEasing, MOTION } from "../motion/timing";
import { classify, GESTURE, isTap, release, rubberBand, type Sample, unband, velocityX } from "./gesture";

export interface SwipeOptions {
  layers(): { current: HTMLElement; next: HTMLElement | null; prev: HTMLElement | null } | null;
  can(): { prev: boolean; next: boolean };
  onTap(): void;
  onDecide(dir: "next" | "prev"): void; // as a release, a key or a button commits, before anything flies
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
  rect: DOMRect; // the card's place, in viewport px
  from: number; // where the touch caught the cards, as the drag that has them there: 0 when they were at rest
  // Where the drag took hold of a card still coming back, untilted, and how far the card it covered had risen: the card
  // tilts, and the card underneath rises, from there. In its place and at rest otherwise.
  held: { x: number; risen: number };
}

// Animations in flight. A commit's carries its direction; input that lands it early lets a fling's card fly on as a
// copy and a slide's card carry on into its place. A spring back carries the cards it moves, which the next touch
// catches where they are.
interface Run {
  animations: Animation[];
  dir: Dir | null;
  flight?: Flight;
  arrival?: Motion;
  spring?: HTMLElement[];
}

// A card's motion: its keyframes, its timing, and the animation playing them.
interface Motion {
  keyframes: Keyframe[];
  timing: KeyframeAnimationOptions;
  animation: Animation;
}

// The card flying out: its layer, and a copy of it as it was flung, which flies on should its move land early. By then a
// reshuffle may have put another card in that layer.
interface Flight extends Motion {
  card: HTMLElement;
  snapshot: HTMLElement;
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
// The card's place on screen, in viewport px: the box its layers lie over (plan §11), which never moves, so it is
// where the card rests even while one is on its way there or back.
const place = (layer: HTMLElement) => (layer.parentElement ?? layer).getBoundingClientRect();
const matrix = (transform: string) => new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
// How far along the x axis a transform puts a layer, in px.
const across = (transform: string) => matrix(transform).m41;
// Where a card rests once it has gone, 80 px past the screen's left edge.
const gone = (card: DOMRect) => -(card.right + 80);
// Where the previous card waits to come back: its right edge on the screen's left edge, so the first pixel of a right
// drag shows its first pixel.
const waiting = (card: DOMRect) => -card.right;
// The card underneath, from resting (p = 0) to in place (p = 1), and how far a transform has it risen.
const LOW = 0.965;
const underneath = (p: number) => `scale(${fixed(LOW + (1 - LOW) * p)}) translateY(${fixed(8 * (1 - p))}px)`;
const risen = (transform: string) => (matrix(transform).m11 - LOW) / (1 - LOW);

function swipe(stage: RefObject<HTMLElement | null>, options: RefObject<SwipeOptions>) {
  let gesture: Gesture | null = null;
  let running: Run | null = null;
  let settling: Run | null = null;
  // The card coming back when its move landed early, still on its way into its place, and the card it covers settling
  // into its own; no run of their own, so the next touch leaves them be.
  let arriving: Animation[] = [];
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
  // Left pending, an animation starts on the next frame, from its first keyframe.
  const animate = (el: Element, keyframes: Keyframe[], timing: KeyframeAnimationOptions) =>
    (options.current.animate ?? ((target, k, o) => target.animate(k, o)))(el, keyframes, timing);
  // A move carries on at once, from the timeline's time (the last frame's): pending, a released card would stand still
  // for a frame, its first keyframe being where the finger left it, before it flew.
  const carryOn = (el: Element, keyframes: Keyframe[], timing: KeyframeAnimationOptions) => {
    const animation = animate(el, keyframes, timing);
    const now = document.timeline?.currentTime;
    if (now != null) animation.startTime = now;
    return animation;
  };

  function play(run: Run) {
    running = run;
    mark("animating");
    Promise.all(run.animations.map((a) => a.finished)).then(
      () => complete(run),
      () => {},
    );
  }

  // Input never waits for an animation: it ends now and its commit completes before anything reads the layers again.
  // (finish() alone would settle `finished` a microtask later.)
  function finishRunning() {
    const run = running;
    if (!run) return;
    if (run.flight) flyOn(run.flight);
    const at = Number(run.arrival?.animation.currentTime);
    for (const animation of run.animations) animation.finish();
    if (complete(run) && run.arrival) arrive(run.arrival, at);
  }

  // The card coming back as its move lands early carries on into its place, from where it is on its curve, in the layer
  // it now has; the card it covers came from the place on top, and settles into its own in the time left. Both end at
  // their layers' resting styles, so nothing is left filling.
  function arrive({ keyframes, timing }: Motion, at: number) {
    const layers = options.current.layers();
    if (!layers) return;
    const carry = carryOn(layers.current, keyframes, timing);
    carry.currentTime = at;
    const now = [carry];
    if (layers.next && !options.current.reducedMotion()) {
      const left = { duration: Number(timing.duration) - at, easing: MOTION.dealEase };
      now.push(carryOn(layers.next, [{ transform: underneath(1) }, { transform: underneath(0) }], left));
    }
    arriving = now;
    Promise.all(now.map((a) => a.finished)).then(
      () => {
        if (arriving === now) arriving = [];
      },
      () => {},
    );
  }

  // The card coming back is in its place now: its layer is about to take another card, or it is being taken hold of.
  function arrived() {
    for (const animation of arriving) animation.cancel();
    arriving = [];
  }

  // Takes hold of the card still coming back and the card it covers, where they are: written inline, their motion let
  // go. Returns where they were held.
  function holdArriving({ current, next }: Layers): Gesture["held"] {
    const card = getComputedStyle(current).transform;
    const under = next && getComputedStyle(next).transform;
    arrived();
    write(current, card);
    if (next && under) write(next, under);
    return { x: across(card), risen: under ? risen(under) : 0 };
  }

  // A card still flying out as the move lands carries on as a copy, from where it is on its curve, over the stack and
  // out of the stage's way; it goes once it has flown. A thumb flicking on never sees the last card vanish mid-air.
  function flyOn({ card, snapshot: copy, keyframes, timing, animation }: Flight) {
    copy.removeAttribute("data-role");
    copy.inert = true;
    copy.setAttribute("aria-hidden", "true");
    Object.assign(copy.style, { visibility: "visible", pointerEvents: "none", transformOrigin: "50% 140%" });
    card.after(copy);
    const flown = carryOn(copy, keyframes, timing);
    flown.currentTime = animation.currentTime;
    flown.finished.then(
      () => copy.remove(),
      () => copy.remove(),
    );
  }

  // A touch catches a spring back where it is: the cards it moves stay there, written inline, and the drag goes on from
  // there. Returns that drag: the card on top's x, or how much of the previous card still shows.
  function catchSpring({ animations, spring = [] }: Run, rect: DOMRect): number {
    const held = new Map(spring.map((el) => [el, getComputedStyle(el).transform]));
    for (const animation of animations) animation.cancel();
    stop();
    for (const [el, transform] of held) write(el, transform);
    const { current, prev } = options.current.layers() ?? {};
    const shown = prev && held.get(prev);
    if (shown) return Math.max(across(shown) - waiting(rect), 0);
    const x = across((current && held.get(current)) ?? "none");
    // Past its place it is a rubber band, or, by a pixel or two, the spring's overshoot.
    if (x <= 0) return x;
    return prev ? 0 : unband(x);
  }

  // A new card came from elsewhere (a reshuffle, a topic change): what was in flight belongs to the old one.
  function abort() {
    if (running?.flight) flyOn(running.flight);
    for (const animation of running?.animations ?? []) animation.cancel();
    arrived();
    stop();
    clear();
  }

  // Nothing in flight any more: the stage is idle, and no longer dealing.
  function stop() {
    running = null;
    mark("idle");
    stage.current?.removeAttribute("data-dealing");
  }

  // Whether the cards moved on.
  function complete(run: Run): boolean {
    if (running !== run) return false;
    stop();
    const { dir } = run;
    if (!dir) {
      clear();
      return false;
    }
    arrived();
    settling = run;
    flushSync(() => options.current.onCommit(dir));
    // A commit that changed nothing (a topic change put the card first while the previous one came back) renders
    // nothing, so no layout effect lets go of the run: let go of it here.
    const moved = settling === null;
    settle();
    return moved;
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

  // A card that moves on mid-flip would travel edge-on: the flip (the card's [data-side] transition) ends first.
  function finishFlip(card: HTMLElement) {
    for (const turning of card.querySelector("[data-side]")?.getAnimations({ subtree: true }) ?? []) turning.finish();
  }

  function follow(g: Gesture, dx: number) {
    const { layers, rect } = g;
    if (dx > 0 && layers.prev) {
      rest(layers.current);
      if (layers.next) rest(layers.next);
      show(layers.prev);
      write(layers.prev, `translateX(${waiting(rect) + dx}px)`);
      return;
    }
    // The card on top moves: one still coming back is taken hold of where it is, and moves on from there.
    if (arriving.length) {
      g.held = holdArriving(layers);
      g.from += g.held.x - dx;
      return follow(g, g.held.x);
    }
    if (layers.prev) rest(layers.prev);
    const { held } = g;
    const x = dx > 0 ? rubberBand(dx) : dx;
    const deg = options.current.reducedMotion() ? 0 : tilt(x - held.x);
    write(layers.current, `translateX(${fixed(x)}px) rotate(${fixed(deg)}deg)`);
    const rise = held.risen + Math.max(held.x - dx, 0) / rect.width / GESTURE.commitFraction;
    if (layers.next && dx < 0) write(layers.next, underneath(Math.min(rise, 1)));
  }

  // A commit's motion, from a release at dx and vx, or from rest for a key or a button (easing given). A released card
  // flies half its width further than gone: its curve slows it to a stop, which then happens off screen.
  function fling(layers: Layers, rect: DOMRect, dx: number, vx: number, easing?: string) {
    const { current, next } = layers;
    if (arriving.length) holdArriving(layers);
    const reduced = options.current.reducedMotion();
    const to = easing ? gone(rect) : gone(rect) - rect.width / 2;
    const timing = reduced
      ? { duration: MOTION.fadeMs }
      : { duration: flingDuration(dx - to, vx), easing: easing ?? flingEasing(dx - to, vx) };
    const keyframes = reduced
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          { transform: current.style.transform || IN_PLACE },
          { transform: `translateX(${to}px) rotate(${-FLING_TILT}deg)` },
        ];
    const snapshot = current.cloneNode(true) as HTMLElement;
    const flight = { card: current, snapshot, keyframes, timing: { ...timing, fill: "forwards" as const } };
    const animation = carryOn(current, flight.keyframes, flight.timing);
    const animations = [animation];
    if (next) {
      // It rises with the card leaving; under reduced motion it is in place at once, under the card fading out.
      const below = next.style.transform || underneath(0);
      write(next, underneath(1));
      if (!reduced) animations.push(carryOn(next, [{ transform: below }, { transform: underneath(1) }], timing));
    }
    play({ animations, dir: "next", flight: { ...flight, animation } });
    // The end card has no card under it: the next pass is dealt at once, under it as it flies off.
    if (!next) finishRunning();
  }

  function slideIn(layers: Layers, rect: DOMRect, dx: number, vx: number, easing?: string) {
    const { prev } = layers;
    if (!prev) return;
    const reduced = options.current.reducedMotion();
    const from = waiting(rect) + dx;
    const timing = reduced
      ? { duration: MOTION.fadeMs }
      : { duration: flingDuration(-from, vx), easing: easing ?? flingEasing(-from, vx) };
    const keyframes = reduced
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ transform: prev.style.transform || `translateX(${from}px)` }, { transform: "translateX(0px)" }];
    show(prev);
    // Under reduced motion it fades in, in place.
    if (reduced) write(prev, "translateX(0px)");
    const animation = carryOn(prev, keyframes, { ...timing, fill: "forwards" });
    play({ animations: [animation], dir: "prev", arrival: { keyframes, timing, animation } });
  }

  function commit(dir: Dir) {
    if (gesture) return;
    finishRunning();
    const layers = options.current.layers();
    if (!layers || !options.current.can()[dir]) return;
    options.current.onDecide(dir);
    finishFlip(layers.current);
    (dir === "next" ? fling : slideIn)(layers, place(layers.current), 0, 0, MOTION.commitEase);
  }

  // Each moved card animates from where it is to its resting style, which it has again as soon as this starts.
  function springBack(g: Gesture) {
    if (options.current.reducedMotion()) return clear();
    const timing = { duration: MOTION.cancelMs, easing: MOTION.cancelEase };
    const animations: Animation[] = [];
    const spring: HTMLElement[] = [];
    for (const [el, home] of [
      [g.layers.current, IN_PLACE],
      [g.layers.next, underneath(0)],
    ] as const) {
      const from = el?.style.transform;
      if (!el || !from) continue;
      rest(el);
      animations.push(carryOn(el, [{ transform: from }, { transform: home }], timing));
      spring.push(el);
    }
    const { prev } = g.layers;
    if (prev?.style.visibility === "visible") {
      // Its resting style is hidden, so it ends off screen, still visible, until the run completes.
      const from = prev.style.transform;
      write(prev, `translateX(${gone(g.rect)}px)`);
      animations.push(carryOn(prev, [{ transform: from }, { transform: prev.style.transform }], timing));
      spring.push(prev);
    }
    play({ animations, dir: null, spring });
  }

  // The gesture this event belongs to: only the first pointer counts.
  const own = (e: PointerEvent) => (gesture?.pointer === e.pointerId ? gesture : null);

  const down = (e: PointerEvent) => {
    if (gesture || e.button !== 0) return;
    const start = sample(e);
    const top = options.current.layers()?.current;
    const rect = top && place(top);
    const onButton = e.target instanceof Element && e.target.closest("button");
    const onCard =
      rect && start.x >= rect.left && start.x <= rect.right && start.y >= rect.top && start.y <= rect.bottom;
    if (!rect || onButton || !onCard) return finishRunning();
    // A spring back under the thumb is caught where it is; anything else in flight lands at once.
    const from = running?.spring ? catchSpring(running, rect) : 0;
    finishRunning();
    const layers = options.current.layers();
    if (!layers) return;
    gesture = {
      pointer: e.pointerId,
      start,
      samples: [start],
      axis: "pending",
      layers,
      rect,
      from,
      held: { x: 0, risen: 0 },
    };
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
    // A frame's move may stand for several touch samples; the velocity wants them all. Browsers offer them in secure
    // contexts only: over plain http away from localhost (the phone trying a laptop's build) the move's own sample does.
    const coalesced = "getCoalescedEvents" in e ? e.getCoalescedEvents() : [];
    for (const c of coalesced.length ? coalesced : [e]) g.samples.push(sample(c));
    if (g.axis === "pending") {
      g.axis = classify(g.start, sample(e));
      if (g.axis === "horizontal") {
        mark("dragging");
        finishFlip(g.layers.current);
      }
    }
    if (g.axis === "horizontal") follow(g, g.from + e.clientX - g.start.x);
  };

  const up = (e: PointerEvent) => {
    const g = own(e);
    if (!g) return;
    end(g);
    if (g.axis !== "horizontal") {
      putBack(g);
      if (g.axis === "pending" && isTap(g.start, sample(e))) options.current.onTap();
      return;
    }
    g.samples.push(sample(e));
    const dx = g.from + e.clientX - g.start.x;
    const vx = velocityX(g.samples);
    const decision = release(dx, vx, g.rect.width, options.current.can());
    if (decision !== "cancel") options.current.onDecide(decision);
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
    else putBack(g);
  };

  // A touch let go without a move: what it caught goes back from where it was caught.
  const putBack = (g: Gesture) => (g.from === 0 ? clear() : springBack(g));

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
    const animations = [animate(layers.current, keyframes, timing)];
    // The card underneath takes the place of the card on top as it goes, and settles into its own under the card
    // dealt: it never shrinks back in a frame.
    if (layers.next && !fade)
      animations.push(animate(layers.next, [{ transform: underneath(1) }, { transform: underneath(0) }], timing));
    play({ animations, dir: null });
    // The card comes in over the one underneath, whose writing would show through it: blank paper until it lands.
    stage.current?.setAttribute("data-dealing", "");
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
  useEffect(() => {
    return machine.listen();
  }, [machine]);
  useLayoutEffect(() => {
    machine.settle();
  });
  return { commit: machine.commit, tap: machine.tap, deal: machine.deal };
}
