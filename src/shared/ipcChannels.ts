export const IpcChannels = {
  setIgnoreMouseEvents: "pet:set-ignore-mouse-events",
  moveTo: "pet:move-to",
  getPosition: "pet:get-position",
  forceShowPopup: "popup:force-show",
  showContextMenu: "pet:show-context-menu",
  contextMenuAction: "pet:context-menu-action",
  popupAppear: "popup:appear",
  popupDisappear: "popup:disappear",

  authStart: "spotify:auth-start",
  authStatusChanged: "spotify:auth-status-changed",
  getAuthStatus: "spotify:get-auth-status",
  logout: "spotify:logout",

  nowPlayingChanged: "spotify:now-playing-changed",
  play: "spotify:play",
  pause: "spotify:pause",
  next: "spotify:next",
  previous: "spotify:previous",
  seek: "spotify:seek",
  getVolume: "spotify:get-volume",
  setVolume: "spotify:set-volume",

  appQuit: "app:quit",

  getLocale: "i18n:get-locale",
  setLocale: "i18n:set-locale",
  localeChanged: "i18n:locale-changed",

  getLabelColor: "theme:get-label-color",
  setLabelColor: "theme:set-label-color",
  labelColorChanged: "theme:label-color-changed",

  getCaseColor: "theme:get-case-color",
  setCaseColor: "theme:set-case-color",
  caseColorChanged: "theme:case-color-changed",

  getFontColor: "theme:get-font-color",
  setFontColor: "theme:set-font-color",
  fontColorChanged: "theme:font-color-changed",

  getUiTheme: "theme:get-ui-theme",
  setUiTheme: "theme:set-ui-theme",
  uiThemeChanged: "theme:ui-theme-changed",

  getShowBorder: "theme:get-show-border",
  setShowBorder: "theme:set-show-border",
  showBorderChanged: "theme:show-border-changed",

  getAutoLaunch: "settings:get-auto-launch",
  setAutoLaunch: "settings:set-auto-launch",

  getPetSize: "settings:get-pet-size",
  setPetSize: "settings:set-pet-size",

  getNotifyTrackChange: "settings:get-notify-track-change",
  setNotifyTrackChange: "settings:set-notify-track-change",

  getPollingSpeed: "settings:get-polling-speed",
  setPollingSpeed: "settings:set-polling-speed",

  getHistorySummary: "history:get-summary",
  getBestTrackForDay: "history:get-best-track-for-day",
  clearHistory: "history:clear",

  resetSettings: "settings:reset",
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
