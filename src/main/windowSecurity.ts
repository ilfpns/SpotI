import type { BrowserWindow } from "electron";

/**
 * Denies in-place navigation and new-window/tab creation on a renderer —
 * part of Electron's own security checklist. This app never needs either
 * (every window only ever loads its own bundled HTML), so if anything ever
 * did try to navigate away (a bug, a compromised dependency, anything),
 * this stops it from turning into a loaded-with-full-preload-privileges
 * window pointed at an arbitrary URL instead of silently doing nothing.
 */
export function hardenWindow(win: BrowserWindow): void {
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}
