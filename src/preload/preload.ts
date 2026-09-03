import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "../shared/ipcChannels";
import type { AuthStatus, NowPlayingState, SpotifyResult } from "../shared/types";
import type { Locale } from "../shared/i18n";
import type { UiTheme, UiThemePreference, CaseShape } from "../shared/theme";
import type { PetSize, PollingSpeed, HoverDelay, CaseSlideSpeed, DiscSpinSpeed } from "../shared/constants";
import type { BestTrack, HistorySummary, RecentPlay, TopAlbum } from "../shared/types";
import type { UpdateCheckResult } from "../main/updateChecker";

const petAPI = {
  moveTo(x: number, y: number) {
    ipcRenderer.send(IpcChannels.moveTo, { x, y });
  },
  getPosition(): Promise<{ x: number; y: number }> {
    return ipcRenderer.invoke(IpcChannels.getPosition);
  },
  savePosition() {
    ipcRenderer.send(IpcChannels.savePosition);
  },
  forceShowPopup() {
    ipcRenderer.send(IpcChannels.forceShowPopup);
  },
  showContextMenu() {
    ipcRenderer.send(IpcChannels.showContextMenu);
  },
  contextMenuAction(action: "settings" | "quit" | "openSpotify") {
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

  getUiTheme(): Promise<UiThemePreference> {
    return ipcRenderer.invoke(IpcChannels.getUiTheme);
  },
  setUiTheme(theme: UiThemePreference) {
    ipcRenderer.send(IpcChannels.setUiTheme, theme);
  },
  onUiThemeChanged(cb: (theme: UiThemePreference) => void) {
    const handler = (_e: unknown, theme: UiThemePreference) => cb(theme);
    ipcRenderer.on(IpcChannels.uiThemeChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.uiThemeChanged, handler);
  },
  getEffectiveUiTheme(): Promise<UiTheme> {
    return ipcRenderer.invoke(IpcChannels.getEffectiveUiTheme);
  },
  onEffectiveUiThemeChanged(cb: (theme: UiTheme) => void) {
    const handler = (_e: unknown, theme: UiTheme) => cb(theme);
    ipcRenderer.on(IpcChannels.effectiveUiThemeChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.effectiveUiThemeChanged, handler);
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

  getHoverDelay(): Promise<HoverDelay> {
    return ipcRenderer.invoke(IpcChannels.getHoverDelay);
  },
  setHoverDelay(delay: HoverDelay) {
    ipcRenderer.send(IpcChannels.setHoverDelay, delay);
  },

  getSpinAnimation(): Promise<boolean> {
    return ipcRenderer.invoke(IpcChannels.getSpinAnimation);
  },
  setSpinAnimation(value: boolean) {
    ipcRenderer.send(IpcChannels.setSpinAnimation, value);
  },
  onSpinAnimationChanged(cb: (value: boolean) => void) {
    const handler = (_e: unknown, value: boolean) => cb(value);
    ipcRenderer.on(IpcChannels.spinAnimationChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.spinAnimationChanged, handler);
  },

  getCaseSlideSpeed(): Promise<CaseSlideSpeed> {
    return ipcRenderer.invoke(IpcChannels.getCaseSlideSpeed);
  },
  setCaseSlideSpeed(speed: CaseSlideSpeed) {
    ipcRenderer.send(IpcChannels.setCaseSlideSpeed, speed);
  },
  onCaseSlideSpeedChanged(cb: (speed: CaseSlideSpeed) => void) {
    const handler = (_e: unknown, speed: CaseSlideSpeed) => cb(speed);
    ipcRenderer.on(IpcChannels.caseSlideSpeedChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.caseSlideSpeedChanged, handler);
  },

  getDiscSpinSpeed(): Promise<DiscSpinSpeed> {
    return ipcRenderer.invoke(IpcChannels.getDiscSpinSpeed);
  },
  setDiscSpinSpeed(speed: DiscSpinSpeed) {
    ipcRenderer.send(IpcChannels.setDiscSpinSpeed, speed);
  },
  onDiscSpinSpeedChanged(cb: (speed: DiscSpinSpeed) => void) {
    const handler = (_e: unknown, speed: DiscSpinSpeed) => cb(speed);
    ipcRenderer.on(IpcChannels.discSpinSpeedChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.discSpinSpeedChanged, handler);
  },

  getMediaKeysEnabled(): Promise<boolean> {
    return ipcRenderer.invoke(IpcChannels.getMediaKeysEnabled);
  },
  setMediaKeysEnabled(value: boolean) {
    ipcRenderer.send(IpcChannels.setMediaKeysEnabled, value);
  },

  getNotificationSound(): Promise<boolean> {
    return ipcRenderer.invoke(IpcChannels.getNotificationSound);
  },
  setNotificationSound(value: boolean) {
    ipcRenderer.send(IpcChannels.setNotificationSound, value);
  },

  getStartHidden(): Promise<boolean> {
    return ipcRenderer.invoke(IpcChannels.getStartHidden);
  },
  setStartHidden(value: boolean) {
    ipcRenderer.send(IpcChannels.setStartHidden, value);
  },

  resetSettings(): Promise<void> {
    return ipcRenderer.invoke(IpcChannels.resetSettings);
  },

  checkForUpdate(): Promise<UpdateCheckResult | null> {
    return ipcRenderer.invoke(IpcChannels.checkForUpdate);
  },
  openReleasePage() {
    ipcRenderer.send(IpcChannels.openReleasePage);
  },

  getHistorySummaryForYear(year: number): Promise<HistorySummary> {
    return ipcRenderer.invoke(IpcChannels.getHistorySummaryForYear, year);
  },
  getHistoryYears(): Promise<number[]> {
    return ipcRenderer.invoke(IpcChannels.getHistoryYears);
  },
  getBestTrackForDay(date: string): Promise<BestTrack | null> {
    return ipcRenderer.invoke(IpcChannels.getBestTrackForDay, date);
  },
  getRecentlyPlayed(limit: number): Promise<RecentPlay[]> {
    return ipcRenderer.invoke(IpcChannels.getRecentlyPlayed, limit);
  },
  getTopAlbumsForWeek(limit: number): Promise<TopAlbum[]> {
    return ipcRenderer.invoke(IpcChannels.getTopAlbumsForWeek, limit);
  },

  getBorderColor(): Promise<string> {
    return ipcRenderer.invoke(IpcChannels.getBorderColor);
  },
  setBorderColor(color: string) {
    ipcRenderer.send(IpcChannels.setBorderColor, color);
  },
  onBorderColorChanged(cb: (color: string) => void) {
    const handler = (_e: unknown, color: string) => cb(color);
    ipcRenderer.on(IpcChannels.borderColorChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.borderColorChanged, handler);
  },

  getDiscName(): Promise<string> {
    return ipcRenderer.invoke(IpcChannels.getDiscName);
  },
  setDiscName(name: string) {
    ipcRenderer.send(IpcChannels.setDiscName, name);
  },
  onDiscNameChanged(cb: (name: string) => void) {
    const handler = (_e: unknown, name: string) => cb(name);
    ipcRenderer.on(IpcChannels.discNameChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.discNameChanged, handler);
  },

  getFollowNowPlayingColor(): Promise<boolean> {
    return ipcRenderer.invoke(IpcChannels.getFollowNowPlayingColor);
  },
  setFollowNowPlayingColor(value: boolean) {
    ipcRenderer.send(IpcChannels.setFollowNowPlayingColor, value);
  },
  onFollowNowPlayingColorChanged(cb: (value: boolean) => void) {
    const handler = (_e: unknown, value: boolean) => cb(value);
    ipcRenderer.on(IpcChannels.followNowPlayingColorChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.followNowPlayingColorChanged, handler);
  },

  getCaseShape(): Promise<CaseShape> {
    return ipcRenderer.invoke(IpcChannels.getCaseShape);
  },
  setCaseShape(shape: CaseShape) {
    ipcRenderer.send(IpcChannels.setCaseShape, shape);
  },
  onCaseShapeChanged(cb: (shape: CaseShape) => void) {
    const handler = (_e: unknown, shape: CaseShape) => cb(shape);
    ipcRenderer.on(IpcChannels.caseShapeChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.caseShapeChanged, handler);
  },

  getOpacity(): Promise<number> {
    return ipcRenderer.invoke(IpcChannels.getOpacity);
  },
  setOpacity(percent: number) {
    ipcRenderer.send(IpcChannels.setOpacity, percent);
  },

  spotify: {
    login(): Promise<{ ok: boolean; message?: string }> {
      return ipcRenderer.invoke(IpcChannels.authStart);
    },
    getClientId(): Promise<string | null> {
      return ipcRenderer.invoke(IpcChannels.getSpotifyClientId);
    },
    setClientId(clientId: string): Promise<void> {
      return ipcRenderer.invoke(IpcChannels.setSpotifyClientId, clientId);
    },
    openDashboard() {
      ipcRenderer.send(IpcChannels.openSpotifyDashboard);
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
    getNowPlaying(): Promise<NowPlayingState | null> {
      return ipcRenderer.invoke(IpcChannels.getNowPlaying);
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
    setShuffle(enabled: boolean): Promise<SpotifyResult<void>> {
      return ipcRenderer.invoke(IpcChannels.setShuffle, enabled);
    },
    setRepeat(mode: "off" | "context" | "track"): Promise<SpotifyResult<void>> {
      return ipcRenderer.invoke(IpcChannels.setRepeat, mode);
    },
  },
};

contextBridge.exposeInMainWorld("petAPI", petAPI);

export type PetAPI = typeof petAPI;
