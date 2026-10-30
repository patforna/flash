export function canFullscreen(): boolean {
  return document.fullscreenEnabled === true && matchMedia("(display-mode: browser)").matches;
}
