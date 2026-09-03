import { app, session } from "electron";
import { createPetWindow, getPetWindow } from "./windows/petWindow";
import { createPopupWindow, getPopupWindow } from "./windows/popupWindow";
import { createTray } from "./trayMenu";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";
import { startPolling, setPollingActive } from "./spotify/pollingService";
import { tryRestoreSession, getAuthStatus } from "./spotify/authService";
import { onPopupVisibilityChange, startPopupCursorWatcher } from "./popupController";
import { IpcChannels } from "../shared/ipcChannels";
import { flushHistoryNow } from "./listeningHistoryStore";
import { registerMediaKeys, unregisterMediaKeys } from "./mediaKeys";

// Two SpotI processes would mean two trays, two pets, and two independent
// pollers hitting the Spotify API for the same account — quit immediately if
// another instance already holds the lock, and just surface the existing
// one instead of doing nothing.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    try {
      const win = getPetWindow();
      if (!win.isDestroyed() && !win.isVisible()) win.show();
    } catch {
      // Pet window doesn't exist yet (still starting up) — nothing to surface.
    }
  });

  runApp();
}

function runApp() {
  app.whenReady().then(async () => {
    // Only in a packaged build — the dev server's HMR client needs eval and a
    // localhost websocket connection that a strict CSP would legitimately
    // block, and Electron itself already only shows the "no CSP" warning in
    // dev. No renderer here ever does its own fetch() to a remote API (all
    // Spotify calls happen in the main process); the only remote content a
    // renderer loads directly is album art images.
    if (!process.env.ELECTRON_RENDERER_URL) {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            "Content-Security-Policy": [
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; object-src 'none'; base-uri 'self'",
            ],
          },
        });
      });
    }

    createPetWindow();
    createPopupWindow();
    // Register IPC handlers before anything async (tray icon rasterization
    // included) so a renderer can never invoke a channel before it exists.
    registerIpcHandlers();
    startPolling();

    onPopupVisibilityChange((visible) => setPollingActive(visible));
    startPopupCursorWatcher();

    void createTray();
    registerMediaKeys();

    const restored = await tryRestoreSession();
    if (restored) {
      getPopupWindow().webContents.send(IpcChannels.authStatusChanged, getAuthStatus());
    }
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("before-quit", () => {
    flushHistoryNow();
  });

  app.on("will-quit", () => {
    unregisterMediaKeys();
  });
}
