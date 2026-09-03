import { BrowserWindow, screen } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const MENU_WIDTH = 180;
const MENU_HEIGHT = 156;

let menuWindow: BrowserWindow | null = null;

// Created lazily on first use rather than at app startup — it's rarely
// opened, and an idle renderer process for it would just be wasted RAM.
function ensureContextMenuWindow(): BrowserWindow {
  if (menuWindow && !menuWindow.isDestroyed()) return menuWindow;

  const win = new BrowserWindow({
    width: MENU_WIDTH,
    height: MENU_HEIGHT,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, "floating");

  win.on("blur", () => {
    if (win.isVisible()) win.hide();
  });

  win.on("closed", () => {
    menuWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/contextmenu/index.html`);
  } else {
    win.loadFile(join(__dirname, "../renderer/contextmenu/index.html"));
  }

  menuWindow = win;
  return win;
}

export function showContextMenuWindow() {
  const win = ensureContextMenuWindow();
  const cursor = screen.getCursorScreenPoint();
  const work = screen.getDisplayNearestPoint(cursor).workArea;

  let x = cursor.x;
  let y = cursor.y;
  x = Math.min(x, work.x + work.width - MENU_WIDTH - 4);
  y = Math.min(y, work.y + work.height - MENU_HEIGHT - 4);

  win.setBounds({ x: Math.round(x), y: Math.round(y), width: MENU_WIDTH, height: MENU_HEIGHT });
  win.showInactive();
  win.focus();
}

export function hideContextMenuWindow() {
  if (menuWindow && !menuWindow.isDestroyed() && menuWindow.isVisible()) {
    menuWindow.hide();
  }
}
