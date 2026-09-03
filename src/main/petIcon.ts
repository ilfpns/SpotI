import { BrowserWindow, type NativeImage } from "electron";
import { getPetSvgMarkup } from "../shared/petSvg";
import { getLabelColor, getCaseColor, getShowBorder, getBorderColor, getDiscName, getCaseShape } from "./themeStore";
import { hardenWindow } from "./windowSecurity";

const ICON_SIZE = 128;

let cachedIcon: NativeImage | null = null;
let pending: Promise<NativeImage> | null = null;

/**
 * Rasterizes the pet's own SVG (see shared/petSvg.ts) into a real bitmap for
 * use as a window/tray icon, using Chromium's own renderer — no image
 * library or external asset needed, and it can never drift from the actual
 * on-screen pet artwork (including the user's chosen LP label/case colors).
 */
export function getPetIcon(): Promise<NativeImage> {
  if (cachedIcon) return Promise.resolve(cachedIcon);
  if (pending) return pending;

  pending = (async () => {
    const win = new BrowserWindow({
      width: ICON_SIZE,
      height: ICON_SIZE,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      webPreferences: { offscreen: true },
    });
    hardenWindow(win);

    const html = `<!doctype html><html><head><style>
      html,body{margin:0;padding:0;width:${ICON_SIZE}px;height:${ICON_SIZE}px;background:transparent;}
      svg{width:100%;height:100%;display:block;}
    </style></head><body>${getPetSvgMarkup(getLabelColor(), getCaseColor(), getShowBorder(), getBorderColor(), getDiscName(), getCaseShape())}</body></html>`;

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const image = await win.webContents.capturePage();
    win.destroy();

    cachedIcon = image;
    return image;
  })();

  return pending;
}

/** Call after the theme color changes so the next getPetIcon() re-renders. */
export function invalidatePetIconCache(): void {
  cachedIcon = null;
  pending = null;
}
