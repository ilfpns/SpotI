import { app } from "electron";
import { createPetWindow } from "./windows/petWindow";
import { createPopupWindow, getPopupWindow } from "./windows/popupWindow";
import { createTray } from "./trayMenu";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";
import { startPolling, setPollingActive } from "./spotify/pollingService";
import { tryRestoreSession, getAuthStatus } from "./spotify/authService";
import { onPopupVisibilityChange, startPopupCursorWatcher } from "./popupController";
import { IpcChannels } from "../shared/ipcChannels";
import { flushHistoryNow } from "./listeningHistoryStore";

app.whenReady().then(async () => {
  createPetWindow();
  createPopupWindow();
  // Register IPC handlers before anything async (tray icon rasterization
  // included) so a renderer can never invoke a channel before it exists.
  registerIpcHandlers();
  startPolling(getPopupWindow);

  onPopupVisibilityChange((visible) => setPollingActive(visible));
  startPopupCursorWatcher();

  void createTray();

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
