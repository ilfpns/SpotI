import type { BrowserWindow } from "electron";
import { Notification, nativeImage } from "electron";
import { getNowPlaying } from "./spotifyApiClient";
import { IpcChannels } from "../../shared/ipcChannels";
import { POLL_INTERVAL_IDLE_MS, POLLING_INTERVAL_ACTIVE_MS } from "../../shared/constants";
import type { NowPlayingState } from "../../shared/types";
import { getNotifyTrackChange, getPollingSpeed, getNotificationSound } from "../appSettingsStore";
import { getLocale } from "../localeStore";
import { translate } from "../../shared/i18n";
import { recordListening } from "../listeningHistoryStore";

let timer: ReturnType<typeof setTimeout> | null = null;
let currentIntervalMs = POLL_INTERVAL_IDLE_MS;
let popupIsActive = false;
let lastState: NowPlayingState | null = null;
let hasPolledOnce = false;
let getWindow: (() => BrowserWindow) | null = null;
let lastTickAt = Date.now();
// Never attribute more than this much listening time to a single tick, so a
// long gap (system sleep, a slow/idle interval, a missed tick) can't get
// counted as if the whole gap was spent listening.
const MAX_LISTENING_CREDIT_MS = 5_000;

function statesEqual(a: NowPlayingState | null, b: NowPlayingState | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.trackId === b.trackId && a.isPlaying === b.isPlaying;
}

async function notifyTrackChanged(state: NowPlayingState) {
  if (!getNotifyTrackChange() || !Notification.isSupported()) return;

  let icon: Electron.NativeImage | undefined;
  if (state.albumArtUrl) {
    try {
      const res = await fetch(state.albumArtUrl);
      icon = nativeImage.createFromBuffer(Buffer.from(await res.arrayBuffer()));
    } catch {
      // no icon, still show the text notification
    }
  }

  const locale = getLocale();
  new Notification({
    title: state.title ?? translate(locale, "popup.unknownTitle"),
    body: state.artist ?? translate(locale, "popup.unknownArtist"),
    icon,
    silent: !getNotificationSound(),
  }).show();
}

async function tick() {
  const now = Date.now();
  const elapsedSinceLastTick = now - lastTickAt;
  lastTickAt = now;

  const result = await getNowPlaying();
  if (result.ok) {
    const nextState = result.data ?? null;

    if (nextState?.isPlaying && nextState.trackId) {
      recordListening(
        nextState.trackId,
        nextState.title,
        nextState.artist,
        nextState.albumArtUrl,
        Math.min(elapsedSinceLastTick, MAX_LISTENING_CREDIT_MS),
      );
    }

    if (!statesEqual(lastState, nextState)) {
      const trackChanged = !!nextState?.trackId && nextState.trackId !== lastState?.trackId;
      lastState = nextState;
      getWindow?.()?.webContents.send(IpcChannels.nowPlayingChanged, nextState);
      if (trackChanged && hasPolledOnce && nextState?.isPlaying) {
        void notifyTrackChanged(nextState);
      }
    }
  }
  hasPolledOnce = true;
  timer = setTimeout(tick, currentIntervalMs);
}

function applyInterval() {
  currentIntervalMs = popupIsActive ? POLLING_INTERVAL_ACTIVE_MS[getPollingSpeed()] : POLL_INTERVAL_IDLE_MS;
}

export function startPolling(windowGetter: () => BrowserWindow) {
  getWindow = windowGetter;
  if (timer) return;
  timer = setTimeout(tick, 0);
}

/** Re-poll immediately (e.g. right after a play/pause/skip action) instead of waiting for the next tick. */
export function pollNow() {
  if (timer) clearTimeout(timer);
  void tick();
}

export function stopPolling() {
  if (timer) clearTimeout(timer);
  timer = null;
}

export function setPollingActive(active: boolean) {
  popupIsActive = active;
  applyInterval();
}

/** Call after the polling-speed setting changes so the currently running interval picks it up right away. */
export function refreshPollingSpeed() {
  applyInterval();
}
