import { ipcMain, app, shell, BrowserWindow, nativeTheme } from "electron";
import { IpcChannels } from "../../shared/ipcChannels";
import * as authService from "../spotify/authService";
import * as spotifyApiClient from "../spotify/spotifyApiClient";
import { getPetWindow, resizePetWindow, currentPetSizePx, applyPetOpacity } from "../windows/petWindow";
import { getSpotifyClientId, setSpotifyClientId } from "../spotify/config";
import { checkForUpdate } from "../updateChecker";
import { getPopupWindow } from "../windows/popupWindow";
import { showSettingsWindow } from "../windows/settingsWindow";
import { showContextMenuWindow, hideContextMenuWindow } from "../windows/contextMenuWindow";
import { forceShowPopup } from "../popupController";
import { pollNow, refreshPollingSpeed, getLastKnownState } from "../spotify/pollingService";
import { getLocale, setLocale } from "../localeStore";
import type { Locale } from "../../shared/i18n";
import {
  getLabelColor,
  setLabelColor,
  getCaseColor,
  setCaseColor,
  getFontColor,
  setFontColor,
  getUiTheme,
  setUiTheme,
  getEffectiveUiTheme,
  getShowBorder,
  setShowBorder,
  getBorderColor,
  setBorderColor,
  getDiscName,
  setDiscName,
} from "../themeStore";
import { invalidatePetIconCache, getPetIcon } from "../petIcon";
import { PET_SIZE_PX, type PetSize, type PollingSpeed } from "../../shared/constants";
import {
  getAutoLaunch,
  setAutoLaunch,
  getPetSize,
  setPetSize,
  getNotifyTrackChange,
  setNotifyTrackChange,
  getPollingSpeed,
  setPollingSpeed,
  getHoverDelay,
  setHoverDelay,
  getSpinAnimation,
  setSpinAnimation,
  getMediaKeysEnabled,
  setMediaKeysEnabled,
  getNotificationSound,
  setNotificationSound,
  getStartHidden,
  setStartHidden,
  getOpacity,
  setOpacity,
  setPetPosition,
} from "../appSettingsStore";
import { refreshMediaKeys } from "../mediaKeys";
import {
  DEFAULT_UI_THEME,
  DEFAULT_SHOW_BORDER,
  DEFAULT_BORDER_COLOR,
  DEFAULT_LABEL_COLOR,
  DEFAULT_CASE_COLOR,
  DEFAULT_FONT_COLOR,
  DEFAULT_DISC_NAME,
} from "../../shared/theme";
import type { UiThemePreference } from "../../shared/theme";
import { getHistorySummaryForYear, getHistoryYears, getBestTrackForDay } from "../listeningHistoryStore";
import {
  DEFAULT_POLLING_SPEED,
  DEFAULT_HOVER_DELAY,
  type HoverDelay,
} from "../../shared/constants";

export function registerIpcHandlers() {
  ipcMain.handle(IpcChannels.authStart, async () => {
    const result = await authService.login();
    getPopupWindow().webContents.send(IpcChannels.authStatusChanged, authService.getAuthStatus());
    return result;
  });

  ipcMain.handle(IpcChannels.getAuthStatus, () => authService.getAuthStatus());

  ipcMain.handle(IpcChannels.getSpotifyClientId, () => getSpotifyClientId());
  ipcMain.handle(IpcChannels.setSpotifyClientId, (_e, clientId: string) => setSpotifyClientId(clientId));
  // Fixed destination, never renderer-supplied — a compromised renderer
  // can't use this to open an arbitrary URL.
  ipcMain.on(IpcChannels.openSpotifyDashboard, () => {
    shell.openExternal("https://developer.spotify.com/dashboard");
  });

  ipcMain.handle(IpcChannels.checkForUpdate, () => checkForUpdate());
  // Same fixed-destination pattern as the Spotify dashboard link above.
  ipcMain.on(IpcChannels.openReleasePage, () => {
    shell.openExternal("https://github.com/ilfpns/SpotI/releases/latest");
  });

  ipcMain.handle(IpcChannels.logout, () => {
    authService.logout();
    getPopupWindow().webContents.send(IpcChannels.authStatusChanged, authService.getAuthStatus());
  });

  // Re-poll right after each control action so the UI reflects it immediately
  // instead of waiting for the next scheduled poll tick.
  ipcMain.handle(IpcChannels.play, async () => {
    const result = await spotifyApiClient.play();
    pollNow();
    return result;
  });
  ipcMain.handle(IpcChannels.pause, async () => {
    const result = await spotifyApiClient.pause();
    pollNow();
    return result;
  });
  ipcMain.handle(IpcChannels.next, async () => {
    const result = await spotifyApiClient.next();
    pollNow();
    return result;
  });
  ipcMain.handle(IpcChannels.previous, async () => {
    const result = await spotifyApiClient.previous();
    pollNow();
    return result;
  });
  ipcMain.handle(IpcChannels.seek, async (_e, positionMs: number) => {
    const result = await spotifyApiClient.seek(positionMs);
    pollNow();
    return result;
  });
  // Reuses the last polling tick's already-fetched state (the pet polls
  // /me/player continuously anyway) instead of a fresh network round trip —
  // falls back to a live fetch only for the rare case Settings is opened
  // before the very first poll has landed.
  ipcMain.handle(IpcChannels.getVolume, () => {
    const cached = getLastKnownState();
    if (cached) return { ok: true, data: cached.volumePercent };
    return spotifyApiClient.getVolume();
  });
  ipcMain.handle(IpcChannels.setVolume, (_e, percent: number) => spotifyApiClient.setVolume(percent));
  ipcMain.handle(IpcChannels.setShuffle, async (_e, enabled: boolean) => {
    const result = await spotifyApiClient.setShuffle(enabled);
    pollNow();
    return result;
  });
  ipcMain.handle(IpcChannels.setRepeat, async (_e, mode: "off" | "context" | "track") => {
    const result = await spotifyApiClient.setRepeat(mode);
    pollNow();
    return result;
  });

  ipcMain.on(IpcChannels.setIgnoreMouseEvents, (_e, ignore: boolean) => {
    getPetWindow().setIgnoreMouseEvents(ignore, { forward: true });
  });

  ipcMain.on(IpcChannels.moveTo, (_e, pos: { x: number; y: number }) => {
    const win = getPetWindow();
    if (win.isDestroyed()) return;
    // Explicitly re-assert width/height alongside position on every move: on
    // this Windows setup, repeated setPosition()/setBounds() calls on a
    // transparent frameless window have been observed to silently corrupt
    // the window's reported width (it visibly grows the longer a drag
    // lasts). Always pass the size we actually intend rather than the
    // live win.getBounds() value — reading that back would just feed any
    // drift right back in and compound it over the drag.
    const size = currentPetSizePx();
    win.setBounds({ x: Math.round(pos.x), y: Math.round(pos.y), width: size, height: size });
  });

  ipcMain.handle(IpcChannels.getPosition, () => {
    const [x, y] = getPetWindow().getPosition();
    return { x, y };
  });

  // Fired once at the end of a drag (not on every pointermove) — persisting
  // on every move would mean a synchronous disk write dozens of times per
  // drag gesture.
  ipcMain.on(IpcChannels.savePosition, () => {
    const win = getPetWindow();
    if (win.isDestroyed()) return;
    const [x, y] = win.getPosition();
    setPetPosition(x, y);
  });

  ipcMain.on(IpcChannels.forceShowPopup, () => forceShowPopup());

  ipcMain.on(IpcChannels.showContextMenu, () => showContextMenuWindow());

  ipcMain.on(IpcChannels.contextMenuAction, (_e, action: "settings" | "quit" | "openSpotify") => {
    hideContextMenuWindow();
    if (action === "settings") showSettingsWindow();
    else if (action === "quit") app.quit();
    // The spotify: URI scheme is registered by the Spotify desktop client
    // itself: this launches it if it isn't running, or just brings the
    // existing window to the front if it already is — no extra logic needed.
    else if (action === "openSpotify") shell.openExternal("spotify:");
  });

  ipcMain.on(IpcChannels.appQuit, () => app.quit());

  ipcMain.handle(IpcChannels.getLocale, () => getLocale());

  ipcMain.on(IpcChannels.setLocale, (_e, locale: Locale) => {
    setLocale(locale);
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.localeChanged, locale);
    }
    getTrayMenuRebuilder()?.();
  });

  ipcMain.handle(IpcChannels.getLabelColor, () => getLabelColor());

  ipcMain.on(IpcChannels.setLabelColor, async (_e, color: string) => {
    setLabelColor(color);
    invalidatePetIconCache();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.labelColorChanged, color);
    }
    // Re-render the tray/settings-window icon from the new color too.
    const icon = await getPetIcon();
    getPetTrayIconSetter()?.(icon);
  });

  ipcMain.handle(IpcChannels.getCaseColor, () => getCaseColor());

  ipcMain.on(IpcChannels.setCaseColor, async (_e, color: string) => {
    setCaseColor(color);
    invalidatePetIconCache();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.caseColorChanged, color);
    }
    // Re-render the tray/settings-window icon from the new color too.
    const icon = await getPetIcon();
    getPetTrayIconSetter()?.(icon);
  });

  ipcMain.handle(IpcChannels.getFontColor, () => getFontColor());

  ipcMain.on(IpcChannels.setFontColor, (_e, color: string) => {
    setFontColor(color);
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.fontColorChanged, color);
    }
  });

  ipcMain.handle(IpcChannels.getUiTheme, () => getUiTheme());
  ipcMain.handle(IpcChannels.getEffectiveUiTheme, () => getEffectiveUiTheme());

  function broadcastEffectiveUiTheme() {
    const effective = getEffectiveUiTheme();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.effectiveUiThemeChanged, effective);
    }
  }

  ipcMain.on(IpcChannels.setUiTheme, (_e, theme: UiThemePreference) => {
    setUiTheme(theme);
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.uiThemeChanged, theme);
    }
    broadcastEffectiveUiTheme();
  });

  // Only matters while the preference is "system" — that's the only case
  // where the OS flipping dark/light should change anything on its own.
  nativeTheme.on("updated", () => {
    if (getUiTheme() === "system") broadcastEffectiveUiTheme();
  });

  ipcMain.handle(IpcChannels.getShowBorder, () => getShowBorder());

  ipcMain.on(IpcChannels.setShowBorder, async (_e, value: boolean) => {
    setShowBorder(value);
    invalidatePetIconCache();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.showBorderChanged, value);
    }
    // Re-render the tray/settings-window icon from the new setting too.
    const icon = await getPetIcon();
    getPetTrayIconSetter()?.(icon);
  });

  ipcMain.handle(IpcChannels.getAutoLaunch, () => getAutoLaunch());
  ipcMain.on(IpcChannels.setAutoLaunch, (_e, value: boolean) => setAutoLaunch(value));

  ipcMain.handle(IpcChannels.getPetSize, () => getPetSize());
  ipcMain.on(IpcChannels.setPetSize, (_e, size: PetSize) => {
    setPetSize(size);
    resizePetWindow(PET_SIZE_PX[size]);
  });

  ipcMain.handle(IpcChannels.getNotifyTrackChange, () => getNotifyTrackChange());
  ipcMain.on(IpcChannels.setNotifyTrackChange, (_e, value: boolean) => setNotifyTrackChange(value));

  ipcMain.handle(IpcChannels.getPollingSpeed, () => getPollingSpeed());
  ipcMain.on(IpcChannels.setPollingSpeed, (_e, speed: PollingSpeed) => {
    setPollingSpeed(speed);
    refreshPollingSpeed();
  });

  ipcMain.handle(IpcChannels.getHoverDelay, () => getHoverDelay());
  ipcMain.on(IpcChannels.setHoverDelay, (_e, delay: HoverDelay) => setHoverDelay(delay));

  ipcMain.handle(IpcChannels.getSpinAnimation, () => getSpinAnimation());
  ipcMain.on(IpcChannels.setSpinAnimation, (_e, value: boolean) => {
    setSpinAnimation(value);
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.spinAnimationChanged, value);
    }
  });

  ipcMain.handle(IpcChannels.getMediaKeysEnabled, () => getMediaKeysEnabled());
  ipcMain.on(IpcChannels.setMediaKeysEnabled, (_e, value: boolean) => {
    setMediaKeysEnabled(value);
    refreshMediaKeys();
  });

  ipcMain.handle(IpcChannels.getNotificationSound, () => getNotificationSound());
  ipcMain.on(IpcChannels.setNotificationSound, (_e, value: boolean) => setNotificationSound(value));

  ipcMain.handle(IpcChannels.getStartHidden, () => getStartHidden());
  ipcMain.on(IpcChannels.setStartHidden, (_e, value: boolean) => setStartHidden(value));

  ipcMain.handle(IpcChannels.getBorderColor, () => getBorderColor());
  ipcMain.on(IpcChannels.setBorderColor, async (_e, color: string) => {
    setBorderColor(color);
    invalidatePetIconCache();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.borderColorChanged, color);
    }
    const icon = await getPetIcon();
    getPetTrayIconSetter()?.(icon);
  });

  ipcMain.handle(IpcChannels.getDiscName, () => getDiscName());
  ipcMain.on(IpcChannels.setDiscName, async (_e, name: string) => {
    setDiscName(name);
    const sanitized = getDiscName();
    invalidatePetIconCache();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.discNameChanged, sanitized);
    }
    const icon = await getPetIcon();
    getPetTrayIconSetter()?.(icon);
  });

  ipcMain.handle(IpcChannels.getOpacity, () => getOpacity());
  ipcMain.on(IpcChannels.setOpacity, (_e, percent: number) => {
    setOpacity(percent);
    applyPetOpacity();
  });

  ipcMain.handle(IpcChannels.getHistorySummaryForYear, (_e, year: number) => getHistorySummaryForYear(year));
  ipcMain.handle(IpcChannels.getHistoryYears, () => getHistoryYears());
  ipcMain.handle(IpcChannels.getBestTrackForDay, (_e, date: string) => getBestTrackForDay(date));

  // Colors and border color reset to the app's own shipped defaults
  // (shared/theme.ts) — locale and pet size reset to the explicitly
  // requested English/medium rather than the fresh-install Korean default.
  ipcMain.handle(IpcChannels.resetSettings, async () => {
    const RESET_LOCALE: Locale = "en";
    const RESET_PET_SIZE: PetSize = "medium";

    setLocale(RESET_LOCALE);
    setLabelColor(DEFAULT_LABEL_COLOR);
    setCaseColor(DEFAULT_CASE_COLOR);
    setFontColor(DEFAULT_FONT_COLOR);
    setUiTheme(DEFAULT_UI_THEME);
    setShowBorder(DEFAULT_SHOW_BORDER);
    setPetSize(RESET_PET_SIZE);
    resizePetWindow(PET_SIZE_PX[RESET_PET_SIZE]);
    setAutoLaunch(false);
    setNotifyTrackChange(true);
    setPollingSpeed(DEFAULT_POLLING_SPEED);
    refreshPollingSpeed();
    setHoverDelay(DEFAULT_HOVER_DELAY);
    setSpinAnimation(true);
    setMediaKeysEnabled(true);
    refreshMediaKeys();
    setNotificationSound(true);
    setStartHidden(false);
    setBorderColor(DEFAULT_BORDER_COLOR);
    setDiscName(DEFAULT_DISC_NAME);
    setOpacity(100);
    applyPetOpacity();

    invalidatePetIconCache();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.localeChanged, RESET_LOCALE);
      win.webContents.send(IpcChannels.labelColorChanged, DEFAULT_LABEL_COLOR);
      win.webContents.send(IpcChannels.caseColorChanged, DEFAULT_CASE_COLOR);
      win.webContents.send(IpcChannels.fontColorChanged, DEFAULT_FONT_COLOR);
      win.webContents.send(IpcChannels.uiThemeChanged, DEFAULT_UI_THEME);
      win.webContents.send(IpcChannels.effectiveUiThemeChanged, getEffectiveUiTheme());
      win.webContents.send(IpcChannels.showBorderChanged, DEFAULT_SHOW_BORDER);
      win.webContents.send(IpcChannels.spinAnimationChanged, true);
      win.webContents.send(IpcChannels.borderColorChanged, DEFAULT_BORDER_COLOR);
    }
    const icon = await getPetIcon();
    getPetTrayIconSetter()?.(icon);
    getTrayMenuRebuilder()?.();
  });
}

// Set by trayMenu.ts once the tray exists, so a theme/locale change can
// refresh it too without this module needing to import Tray/BrowserWindow
// wiring (trayMenu.ts already imports from this module, so a direct import
// the other way round would be circular).
let petTrayIconSetter: ((icon: Electron.NativeImage) => void) | null = null;
export function registerTrayIconSetter(setter: (icon: Electron.NativeImage) => void) {
  petTrayIconSetter = setter;
}
function getPetTrayIconSetter() {
  return petTrayIconSetter;
}

let trayMenuRebuilder: (() => void) | null = null;
export function registerTrayMenuRebuilder(rebuilder: () => void) {
  trayMenuRebuilder = rebuilder;
}
function getTrayMenuRebuilder() {
  return trayMenuRebuilder;
}
