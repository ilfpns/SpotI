import { BrowserWindow, screen } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PET_SIZE_PX } from "../../shared/constants";
import { getPetSize, getStartHidden, getOpacity, getPetPosition } from "../appSettingsStore";
import { hardenWindow } from "../windowSecurity";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

let petWindow: BrowserWindow | null = null;

export function getPetWindow(): BrowserWindow {
  if (!petWindow) throw new Error("Pet window has not been created yet");
  return petWindow;
}

export function currentPetSizePx(): number {
  return PET_SIZE_PX[getPetSize()];
}

/** Whether a size x size window at (x, y) would land fully within some currently connected display's work area — checking only the primary display would strand a position saved on a second monitor (or from a since-changed monitor layout) and silently reset it every restart, which looks exactly like the pet "disappearing" to someone looking at the other screen. */
function isOnAnyDisplay(x: number, y: number, size: number): boolean {
  return screen.getAllDisplays().some(
    (d) =>
      x >= d.workArea.x &&
      x <= d.workArea.x + d.workArea.width - size &&
      y >= d.workArea.y &&
      y <= d.workArea.y + d.workArea.height - size,
  );
}

export function createPetWindow(): BrowserWindow {
  // Deliberately small: Windows silently refuses to keep a window topmost once
  // it covers a large fraction of the screen (treated like a fullscreen app).
  // A window sized to just the sprite avoids that entirely, and is the same
  // approach real desktop-pet apps use.
  // Default to the bottom-right corner of the primary display's work area,
  // a conventional spot for a desktop mascot to sit until dragged elsewhere.
  const size = currentPetSizePx();
  const workArea = screen.getPrimaryDisplay().workArea;
  let initialX = workArea.x + workArea.width - size - 24;
  let initialY = workArea.y + workArea.height - size - 24;

  // Restore wherever the user last dragged it, as long as that point still
  // falls within some currently connected display's work area (a saved spot
  // from a monitor that's since been unplugged, or a stale/corrupt value,
  // would otherwise strand it off-screen).
  const saved = getPetPosition();
  if (saved && isOnAnyDisplay(saved.x, saved.y, size)) {
    initialX = saved.x;
    initialY = saved.y;
  }

  const win = new BrowserWindow({
    x: initialX,
    y: initialY,
    width: size,
    height: size,
    show: !getStartHidden(),
    opacity: getOpacity() / 100,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    fullscreenable: false,
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // An always-on-top floating pet is meant to keep wandering, hovering,
      // and (once revealed) spinning even when the OS's own occlusion
      // tracking thinks something else covers it — Chromium's default
      // background throttling would otherwise pause its rAF-driven
      // animations and hover detection in exactly that case.
      backgroundThrottling: false,
    },
  });

  hardenWindow(win);
  win.setAlwaysOnTop(true, "floating");
  // Deliberately NOT click-through: the pet's window is small (48-88px), and
  // always capturing clicks in its own bounds means nothing underneath it
  // can ever be clicked by accident through it, at the cost of that small
  // patch of desktop being briefly unclickable while the pet sits there.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const reassertTopmost = () => {
    if (!win.isDestroyed()) win.setAlwaysOnTop(true, "floating");
  };
  win.on("blur", reassertTopmost);
  const reassertInterval = setInterval(reassertTopmost, 3000);
  win.on("closed", () => {
    clearInterval(reassertInterval);
    petWindow = null;
  });

  win.webContents.on("console-message", (_e, _level, message) => {
    console.log("[pet-renderer]", message);
  });
  win.webContents.on("did-fail-load", (_e, code, description) => {
    console.log("[petWindow] did-fail-load", code, description);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/pet/index.html`);
  } else {
    win.loadFile(join(__dirname, "../renderer/pet/index.html"));
  }

  petWindow = win;
  return win;
}

/** Clamps (x, y) to fit within whichever connected display it's nearest to, for a size x size window — used every time the pet's position is set from outside a real, already-on-screen drag, so a corrupted or stale coordinate (see moveTo's own handler comment on Windows silently corrupting setBounds() during a drag) can never leave it stranded off every display. */
export function clampToVisibleArea(x: number, y: number, size: number): { x: number; y: number } {
  const wa = screen.getDisplayMatching({ x, y, width: size, height: size }).workArea;
  return {
    x: Math.min(Math.max(x, wa.x), wa.x + wa.width - size),
    y: Math.min(Math.max(y, wa.y), wa.y + wa.height - size),
  };
}

/** Resize the pet window in place (top-left corner stays put) when the user changes the size preset. */
export function resizePetWindow(sizePx: number): void {
  const win = getPetWindow();
  if (win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  win.setBounds({ x, y, width: sizePx, height: sizePx });
}

/** Re-read the opacity setting and apply it to the live pet window. */
export function applyPetOpacity(): void {
  const win = getPetWindow();
  if (win.isDestroyed()) return;
  win.setOpacity(getOpacity() / 100);
}
