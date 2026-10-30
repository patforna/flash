export function tick(ms = 8): void {
  if (matchMedia("(pointer: coarse)").matches) navigator.vibrate(ms);
}
