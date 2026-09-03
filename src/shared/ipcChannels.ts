export const IpcChannels = {
  moveTo: "pet:move-to",
  getPosition: "pet:get-position",
  savePosition: "pet:save-position",
  forceShowPopup: "popup:force-show",
  showContextMenu: "pet:show-context-menu",
  contextMenuAction: "pet:context-menu-action",
  popupAppear: "popup:appear",
  popupDisappear: "popup:disappear",

  authStart: "spotify:auth-start",
  authStatusChanged: "spotify:auth-status-changed",
  getAuthStatus: "spotify:get-auth-status",
  logout: "spotify:logout",
  getSpotifyClientId: "spotify:get-client-id",
  setSpotifyClientId: "spotify:set-client-id",
  openSpotifyDashboard: "spotify:open-dashboard",

  checkForUpdate: "app:check-for-update",
  openReleasePage: "app:open-release-page",

  nowPlayingChanged: "spotify:now-playing-changed",
  play: "spotify:play",
  pause: "spotify:pause",
  next: "spotify:next",
  previous: "spotify:previous",
  seek: "spotify:seek",
  getVolume: "spotify:get-volume",
  setVolume: "spotify:set-volume",
  setShuffle: "spotify:set-shuffle",
  setRepeat: "spotify:set-repeat",

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
  getEffectiveUiTheme: "theme:get-effective-ui-theme",
  effectiveUiThemeChanged: "theme:effective-ui-theme-changed",

  getShowBorder: "theme:get-show-border",
  setShowBorder: "theme:set-show-border",
  showBorderChanged: "theme:show-border-changed",

  getBorderColor: "theme:get-border-color",
  setBorderColor: "theme:set-border-color",
  borderColorChanged: "theme:border-color-changed",

  getDiscName: "theme:get-disc-name",
  setDiscName: "theme:set-disc-name",
  discNameChanged: "theme:disc-name-changed",

  getFollowNowPlayingColor: "theme:get-follow-now-playing-color",
  setFollowNowPlayingColor: "theme:set-follow-now-playing-color",
  followNowPlayingColorChanged: "theme:follow-now-playing-color-changed",

  getCaseShape: "theme:get-case-shape",
  setCaseShape: "theme:set-case-shape",
  caseShapeChanged: "theme:case-shape-changed",

  getOpacity: "settings:get-opacity",
  setOpacity: "settings:set-opacity",

  getAutoLaunch: "settings:get-auto-launch",
  setAutoLaunch: "settings:set-auto-launch",

  getPetSize: "settings:get-pet-size",
  setPetSize: "settings:set-pet-size",

  getNotifyTrackChange: "settings:get-notify-track-change",
  setNotifyTrackChange: "settings:set-notify-track-change",

  getPollingSpeed: "settings:get-polling-speed",
  setPollingSpeed: "settings:set-polling-speed",

  getHoverDelay: "settings:get-hover-delay",
  setHoverDelay: "settings:set-hover-delay",

  getSpinAnimation: "settings:get-spin-animation",
  setSpinAnimation: "settings:set-spin-animation",
  spinAnimationChanged: "settings:spin-animation-changed",

  getCaseSlideSpeed: "settings:get-case-slide-speed",
  setCaseSlideSpeed: "settings:set-case-slide-speed",
  caseSlideSpeedChanged: "settings:case-slide-speed-changed",

  getDiscSpinSpeed: "settings:get-disc-spin-speed",
  setDiscSpinSpeed: "settings:set-disc-spin-speed",
  discSpinSpeedChanged: "settings:disc-spin-speed-changed",

  getMediaKeysEnabled: "settings:get-media-keys-enabled",
  setMediaKeysEnabled: "settings:set-media-keys-enabled",

  getNotificationSound: "settings:get-notification-sound",
  setNotificationSound: "settings:set-notification-sound",

  getStartHidden: "settings:get-start-hidden",
  setStartHidden: "settings:set-start-hidden",

  getHistorySummaryForYear: "history:get-summary-for-year",
  getHistoryYears: "history:get-years",
  getBestTrackForDay: "history:get-best-track-for-day",
  getTrackStats: "history:get-track-stats",

  resetSettings: "settings:reset",

  isTrackSaved: "spotify:is-track-saved",
  saveTrack: "spotify:save-track",
  removeSavedTrack: "spotify:remove-saved-track",
  getSavedTracks: "spotify:get-saved-tracks",
} as const;
