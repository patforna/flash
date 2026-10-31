// Only a browser tab offers fullscreen: the installed app already is (display-mode fullscreen). fullscreenEnabled is
// undefined where the API is missing.
export function canFullscreen(): boolean {
  return (
    document.fullscreenEnabled === true && matchMedia("(display-mode: browser)").matches && !document.fullscreenElement
  );
}

// Something is fullscreen through the API: a tab that went fullscreen, with a way back out. The installed app is
// fullscreen by its manifest, with nothing to leave: fullscreenElement is null there.
export function isFullscreen(): boolean {
  return document.fullscreenElement != null;
}

// Android locks the orientation only in fullscreen, so the lock waits for the request.
export async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    await screen.orientation.lock("landscape");
  } catch {
    // Refused (no user gesture, a desktop that can't lock) or missing: the page simply stays as it is.
  }
}
