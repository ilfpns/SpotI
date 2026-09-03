import { BrowserWindow } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPetIcon } from "../petIcon";
import { hardenWindow } from "../windowSecurity";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const SETTINGS_WIDTH = 860;
const SETTINGS_HEIGHT = 560;

let settingsWindow: BrowserWindow | null = null;

/** The open settings window, if any — lets other main-process code (e.g. a theme-color change refreshing the window icon) reach it without needing its own registration callback. */
export function getSettingsWindowIfOpen(): BrowserWindow | null {
  return settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null;
}

export function showSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  const win = new BrowserWindow({
    width: SETTINGS_WIDTH,
    height: SETTINGS_HEIGHT,
    title: "Settings",
    backgroundColor: "#18181b",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  hardenWindow(win);

  // The icon is rasterized from the pet's own SVG (see main/petIcon.ts) —
  // applied once it resolves rather than blocking window creation on it.
  getPetIcon().then((icon) => {
    if (!win.isDestroyed()) win.setIcon(icon);
  });

  win.webContents.on("console-message", (_e, _level, message) => {
    console.log("[settings-renderer]", message);
  });
  win.webContents.on("did-fail-load", (_e, code, description) => {
    console.log("[settingsWindow] did-fail-load", code, description);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/settings/index.html`);
  } else {
    win.loadFile(join(__dirname, "../renderer/settings/index.html"));
  }

  win.on("closed", () => {
    settingsWindow = null;
  });

  settingsWindow = win;
  return win;
}
