// Only a browser tab offers fullscreen: the installed app already is (display-mode fullscreen). fullscreenEnabled is
// undefined where the API is missing.
export function canFullscreen(): boolean {
  return (
    document.fullscreenEnabled === true &&
    matchMedia("(display-mode: browser)").matches &&
    !document.fullscreenElement
  );
}

export async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    await screen.orientation.lock("landscape");
  } catch {
    // Refused or unsupported: the page simply stays as it is.
  }
}
