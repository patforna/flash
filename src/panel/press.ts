import type { PointerEvent } from "react";

// A sticker is pushed in while a pointer is down on it, from the moment it goes down (data-pressed, which the
// stylesheets key off), as the card is. Not :active: a touch screen sets that only once a quick tap has lifted, and then
// holds it for 150 ms, so the push played after the thumb had gone.
const down = (e: PointerEvent<HTMLElement>) => e.currentTarget.setAttribute("data-pressed", "");
const up = (e: PointerEvent<HTMLElement>) => e.currentTarget.removeAttribute("data-pressed");

export const press = { onPointerDown: down, onPointerUp: up, onPointerCancel: up, onPointerLeave: up };
