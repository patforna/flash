// A short buzz on a commit or a chip toggle; phones only (plan §4). Never on a flip.
export function tick(ms = 8): void {
  try {
    if (matchMedia("(pointer: coarse)").matches) navigator.vibrate(ms);
  } catch {
    // No vibration motor, or the browser refused: a missed buzz must never break the gesture that asked for it.
  }
}
