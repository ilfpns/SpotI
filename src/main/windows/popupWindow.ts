import { BrowserWindow, screen } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const POPUP_WIDTH = 360;
const POPUP_HEIGHT = 190;

let popupWindow: BrowserWindow | null = null;

export function getPopupWindow(): BrowserWindow {
  if (!popupWindow) throw new Error("Popup window has not been created yet");
  return popupWindow;
}

export function createPopupWindow(): BrowserWindow {
  const win = new BrowserWindow({
    x: 100,
    y: 100,
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    transparent: true,
    // Some Windows/Electron combinations still show a faint edge artifact
    // with transparent:true alone; an explicit ARGB-transparent background
    // avoids it.
    backgroundColor: "#00000000",
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    // Windows 11 auto-rounds window corners at the OS level, which doesn't
    // line up with our own CSS-drawn rounded card and leaves a stray square
    // sliver where the two roundings disagree — draw the rounding ourselves.
    roundedCorners: false,
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
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const reassertTopmost = () => {
    if (!win.isDestroyed() && win.isVisible()) win.setAlwaysOnTop(true, "floating");
  };
  const reassertInterval = setInterval(reassertTopmost, 3000);
  win.on("closed", () => {
    clearInterval(reassertInterval);
    popupWindow = null;
  });

  win.webContents.on("console-message", (_e, _level, message) => {
    console.log("[popup-renderer]", message);
  });
  win.webContents.on("did-fail-load", (_e, code, description) => {
    console.log("[popupWindow] did-fail-load", code, description);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/popup/index.html`);
  } else {
    win.loadFile(join(__dirname, "../renderer/popup/index.html"));
  }

  popupWindow = win;
  return win;
}

/** Returns which side of the popup faces the pet, so the entrance/exit animation can anchor there. */
export function positionPopupNearPet(petBounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): "above" | "below" {
  const win = getPopupWindow();
  const display = screen.getDisplayNearestPoint({
    x: petBounds.x,
    y: petBounds.y,
  });
  const work = display.workArea;

  let left = petBounds.x + petBounds.width / 2 - POPUP_WIDTH / 2;
  left = Math.min(Math.max(left, work.x + 4), work.x + work.width - POPUP_WIDTH - 4);

  // A small real gap (not an overlap) — overlapping let the pet visually cut
  // into the card's bottom edge, which read as the card being clipped.
  const GAP_PX = 10;
  let top = petBounds.y - POPUP_HEIGHT - GAP_PX;
  let side: "above" | "below" = "above";
  if (top < work.y + 4) {
    top = petBounds.y + petBounds.height + GAP_PX;
    side = "below";
  }

  win.setBounds({ x: Math.round(left), y: Math.round(top), width: POPUP_WIDTH, height: POPUP_HEIGHT });
  return side;
}
