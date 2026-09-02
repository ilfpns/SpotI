import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "../shared/ipcChannels";
import type { AuthStatus, NowPlayingState, SpotifyResult } from "../shared/types";
import type { Locale } from "../shared/i18n";
import type { UiTheme } from "../shared/theme";
import type { PetSize, PollingSpeed } from "../shared/constants";
import type { BestTrack, HistorySummary } from "../shared/types";

const petAPI = {
  setIgnoreMouseEvents(ignore: boolean) {
    ipcRenderer.send(IpcChannels.setIgnoreMouseEvents, ignore);
  },
  moveTo(x: number, y: number) {
    ipcRenderer.send(IpcChannels.moveTo, { x, y });
  },
  getPosition(): Promise<{ x: number; y: number }> {
    return ipcRenderer.invoke(IpcChannels.getPosition);
  },
  forceShowPopup() {
    ipcRenderer.send(IpcChannels.forceShowPopup);
  },
  showContextMenu() {
    ipcRenderer.send(IpcChannels.showContextMenu);
  },
  contextMenuAction(action: "settings" | "quit") {
    ipcRenderer.send(IpcChannels.contextMenuAction, action);
  },
  onPopupAppear(cb: (side: "above" | "below") => void) {
    const handler = (_e: unknown, side: "above" | "below") => cb(side);
    ipcRenderer.on(IpcChannels.popupAppear, handler);
    return () => ipcRenderer.removeListener(IpcChannels.popupAppear, handler);
  },
  onPopupDisappear(cb: (side: "above" | "below") => void) {
    const handler = (_e: unknown, side: "above" | "below") => cb(side);
    ipcRenderer.on(IpcChannels.popupDisappear, handler);
    return () => ipcRenderer.removeListener(IpcChannels.popupDisappear, handler);
  },
  quit() {
    ipcRenderer.send(IpcChannels.appQuit);
  },
  getRuntimeInfo() {
    return {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      platform: process.platform,
    };
  },

  getLocale(): Promise<Locale> {
    return ipcRenderer.invoke(IpcChannels.getLocale);
  },
  setLocale(locale: Locale) {
    ipcRenderer.send(IpcChannels.setLocale, locale);
  },
  onLocaleChanged(cb: (locale: Locale) => void) {
    const handler = (_e: unknown, locale: Locale) => cb(locale);
    ipcRenderer.on(IpcChannels.localeChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.localeChanged, handler);
  },

  getLabelColor(): Promise<string> {
    return ipcRenderer.invoke(IpcChannels.getLabelColor);
  },
  setLabelColor(color: string) {
    ipcRenderer.send(IpcChannels.setLabelColor, color);
  },
  onLabelColorChanged(cb: (color: string) => void) {
    const handler = (_e: unknown, color: string) => cb(color);
    ipcRenderer.on(IpcChannels.labelColorChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.labelColorChanged, handler);
  },

  getCaseColor(): Promise<string> {
    return ipcRenderer.invoke(IpcChannels.getCaseColor);
  },
  setCaseColor(color: string) {
    ipcRenderer.send(IpcChannels.setCaseColor, color);
  },
  onCaseColorChanged(cb: (color: string) => void) {
    const handler = (_e: unknown, color: string) => cb(color);
    ipcRenderer.on(IpcChannels.caseColorChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.caseColorChanged, handler);
  },

  getFontColor(): Promise<string> {
    return ipcRenderer.invoke(IpcChannels.getFontColor);
  },
  setFontColor(color: string) {
    ipcRenderer.send(IpcChannels.setFontColor, color);
  },
  onFontColorChanged(cb: (color: string) => void) {
    const handler = (_e: unknown, color: string) => cb(color);
    ipcRenderer.on(IpcChannels.fontColorChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.fontColorChanged, handler);
  },

  getUiTheme(): Promise<UiTheme> {
    return ipcRenderer.invoke(IpcChannels.getUiTheme);
  },
  setUiTheme(theme: UiTheme) {
    ipcRenderer.send(IpcChannels.setUiTheme, theme);
  },
  onUiThemeChanged(cb: (theme: UiTheme) => void) {
    const handler = (_e: unknown, theme: UiTheme) => cb(theme);
    ipcRenderer.on(IpcChannels.uiThemeChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.uiThemeChanged, handler);
  },

  getShowBorder(): Promise<boolean> {
    return ipcRenderer.invoke(IpcChannels.getShowBorder);
  },
  setShowBorder(value: boolean) {
    ipcRenderer.send(IpcChannels.setShowBorder, value);
  },
  onShowBorderChanged(cb: (value: boolean) => void) {
    const handler = (_e: unknown, value: boolean) => cb(value);
    ipcRenderer.on(IpcChannels.showBorderChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.showBorderChanged, handler);
  },

  getAutoLaunch(): Promise<boolean> {
    return ipcRenderer.invoke(IpcChannels.getAutoLaunch);
  },
  setAutoLaunch(value: boolean) {
    ipcRenderer.send(IpcChannels.setAutoLaunch, value);
  },

  getPetSize(): Promise<PetSize> {
    return ipcRenderer.invoke(IpcChannels.getPetSize);
  },
  setPetSize(size: PetSize) {
    ipcRenderer.send(IpcChannels.setPetSize, size);
  },

  getNotifyTrackChange(): Promise<boolean> {
    return ipcRenderer.invoke(IpcChannels.getNotifyTrackChange);
  },
  setNotifyTrackChange(value: boolean) {
    ipcRenderer.send(IpcChannels.setNotifyTrackChange, value);
  },

  getPollingSpeed(): Promise<PollingSpeed> {
    return ipcRenderer.invoke(IpcChannels.getPollingSpeed);
  },
  setPollingSpeed(speed: PollingSpeed) {
    ipcRenderer.send(IpcChannels.setPollingSpeed, speed);
  },

  resetSettings(): Promise<void> {
    return ipcRenderer.invoke(IpcChannels.resetSettings);
  },

  getHistorySummary(): Promise<HistorySummary> {
    return ipcRenderer.invoke(IpcChannels.getHistorySummary);
  },
  getBestTrackForDay(date: string): Promise<BestTrack | null> {
    return ipcRenderer.invoke(IpcChannels.getBestTrackForDay, date);
  },
  clearHistory(): Promise<void> {
    return ipcRenderer.invoke(IpcChannels.clearHistory);
  },

  spotify: {
    login(): Promise<{ ok: boolean; message?: string }> {
      return ipcRenderer.invoke(IpcChannels.authStart);
    },
    logout(): Promise<void> {
      return ipcRenderer.invoke(IpcChannels.logout);
    },
    getAuthStatus(): Promise<AuthStatus> {
      return ipcRenderer.invoke(IpcChannels.getAuthStatus);
    },
    onAuthStatusChanged(cb: (status: AuthStatus) => void) {
      const handler = (_e: unknown, status: AuthStatus) => cb(status);
      ipcRenderer.on(IpcChannels.authStatusChanged, handler);
      return () => ipcRenderer.removeListener(IpcChannels.authStatusChanged, handler);
    },
    onNowPlayingChanged(cb: (state: NowPlayingState | null) => void) {
      const handler = (_e: unknown, state: NowPlayingState | null) => cb(state);
      ipcRenderer.on(IpcChannels.nowPlayingChanged, handler);
      return () => ipcRenderer.removeListener(IpcChannels.nowPlayingChanged, handler);
    },
    play(): Promise<SpotifyResult<void>> {
      return ipcRenderer.invoke(IpcChannels.play);
    },
    pause(): Promise<SpotifyResult<void>> {
      return ipcRenderer.invoke(IpcChannels.pause);
    },
    next(): Promise<SpotifyResult<void>> {
      return ipcRenderer.invoke(IpcChannels.next);
    },
    previous(): Promise<SpotifyResult<void>> {
      return ipcRenderer.invoke(IpcChannels.previous);
    },
    seek(positionMs: number): Promise<SpotifyResult<void>> {
      return ipcRenderer.invoke(IpcChannels.seek, positionMs);
    },
    getVolume(): Promise<SpotifyResult<number | null>> {
      return ipcRenderer.invoke(IpcChannels.getVolume);
    },
    setVolume(percent: number): Promise<SpotifyResult<void>> {
      return ipcRenderer.invoke(IpcChannels.setVolume, percent);
    },
  },
};

contextBridge.exposeInMainWorld("petAPI", petAPI);

export type PetAPI = typeof petAPI;
