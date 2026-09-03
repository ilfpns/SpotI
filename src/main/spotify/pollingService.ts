import { BrowserWindow, Notification, nativeImage } from "electron";
import { getNowPlaying } from "./spotifyApiClient";
import { IpcChannels } from "../../shared/ipcChannels";
import { POLL_INTERVAL_IDLE_MS, POLLING_INTERVAL_ACTIVE_MS } from "../../shared/constants";
import type { NowPlayingState } from "../../shared/types";
import { getNotifyTrackChange, getPollingSpeed, getNotificationSound } from "../appSettingsStore";
import { getLocale } from "../localeStore";
import { translate } from "../../shared/i18n";
import { recordListening, recordTrackStart } from "../listeningHistoryStore";

let timer: ReturnType<typeof setTimeout> | null = null;
let currentIntervalMs = POLL_INTERVAL_IDLE_MS;
let popupIsActive = false;
let lastState: NowPlayingState | null = null;
let hasPolledOnce = false;
let lastTickAt = Date.now();

// A regular scheduled tick can still be mid-flight (awaiting its own
// getNowPlaying() call) when a play/pause action fires — if that tick
// happens to have queried Spotify just *before* the action actually took
// effect there, it resolves with stale data and would otherwise overwrite
// the correct optimistic broadcast the instant it lands, causing a visible
// flicker (case pops back open/shut, then settles). Every tick grabs a
// fresh token at its own start and only broadcasts if it's still the most
// recent one by the time it resolves; anything that supersedes it
// (a newer tick, or an optimistic broadcast) bumps this and silently
// discards the stale response instead of acting on it.
let requestToken = 0;

// Spotify's own GET /me/player can still echo the pre-action isPlaying for a
// brief moment after a play/pause PUT has already returned success (server-side
// propagation lag) — the immediate pollNow() right after that action, or even a
// regular tick landing in this window, would otherwise fetch that stale value
// and flicker the confirmed state back before a later tick corrects it again.
// While this guard is active, a poll's isPlaying is trusted only if it agrees
// with the optimistic value; a disagreement is treated as propagation lag and
// overridden, while every other field (progress, track) still comes from the
// fresh poll.
const OPTIMISTIC_GUARD_MS = 1500;
let lastOptimisticIsPlaying: boolean | null = null;
let optimisticGuardUntil = 0;

/** Every window cares about now-playing state (the popup shows it, the pet's case reveal/spin now mirrors isPlaying) — not just the popup. */
function broadcastNowPlaying(state: NowPlayingState | null) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.nowPlayingChanged, state);
  }
}
// Never attribute more than this much listening time to a single tick, so a
// long gap (system sleep, a slow/idle interval, a missed tick) can't get
// counted as if the whole gap was spent listening.
const MAX_LISTENING_CREDIT_MS = 5_000;

// shuffleState/repeatState are included because the popup's shuffle/repeat
// buttons update optimistically on click and rely on the next
// onNowPlayingChanged broadcast to reconcile with what Spotify actually did
// (same pattern as isPlaying) — if Spotify ignores or overrides a toggle
// and this comparison didn't notice, the popup would keep showing the wrong
// state indefinitely, since nothing else re-broadcasts on those fields
// alone. progressMs/volumePercent are deliberately excluded: progress is
// interpolated client-side rather than pushed every tick, and volume has
// its own direct getVolume() read path.
function statesEqual(a: NowPlayingState | null, b: NowPlayingState | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.trackId === b.trackId &&
    a.isPlaying === b.isPlaying &&
    a.shuffleState === b.shuffleState &&
    a.repeatState === b.repeatState
  );
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
  const myToken = ++requestToken;
  const now = Date.now();
  const elapsedSinceLastTick = now - lastTickAt;
  lastTickAt = now;

  const result = await getNowPlaying();
  if (myToken === requestToken && result.ok) {
    let nextState = result.data ?? null;

    if (
      nextState &&
      lastOptimisticIsPlaying !== null &&
      Date.now() < optimisticGuardUntil &&
      nextState.isPlaying !== lastOptimisticIsPlaying
    ) {
      nextState = { ...nextState, isPlaying: lastOptimisticIsPlaying };
    }

    if (nextState?.isPlaying && nextState.trackId) {
      recordListening(
        nextState.trackId,
        nextState.title,
        nextState.artist,
        nextState.albumArtUrl,
        Math.min(elapsedSinceLastTick, MAX_LISTENING_CREDIT_MS),
      );
    }

    // statesEqual only looks at trackId/isPlaying — deliberately, so a
    // renderer isn't re-notified over an unchanged track/playback state.
    // lastState itself must NOT be gated the same way: getLastKnownState()
    // is used as a cache for reads that aren't trackId/isPlaying (e.g. the
    // getVolume IPC handler reads cached.volumePercent) — gating the
    // assignment here left volume/shuffle/repeat/progress frozen at
    // whatever they were during the last trackId/isPlaying change, even
    // though every tick was fetching fresh values for them the whole time.
    const changed = !statesEqual(lastState, nextState);
    const trackChanged = changed && !!nextState?.trackId && nextState.trackId !== lastState?.trackId;
    lastState = nextState;
    if (changed) {
      broadcastNowPlaying(nextState);
      if (trackChanged && hasPolledOnce && nextState?.isPlaying) {
        recordTrackStart(nextState.trackId!, nextState.title, nextState.artist, nextState.albumArtUrl);
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

export function startPolling() {
  if (timer) return;
  timer = setTimeout(tick, 0);
}

/**
 * Broadcasts the known new isPlaying state immediately after a play/pause
 * call succeeds, instead of every window waiting on pollNow()'s full
 * network round trip (getNowPlaying() -> Spotify) just to find out
 * something they already know the answer to. pollNow() still runs
 * right after this for everything else that action might have changed
 * (progress, in rare cases the track itself) — this just removes the
 * lag for the one thing that's already certain.
 */
export function broadcastOptimisticPlayState(isPlaying: boolean): void {
  if (!lastState) return;
  // Invalidates any tick that's already mid-flight (queried Spotify before
  // this action took effect there) so its stale response gets silently
  // discarded instead of overwriting this the instant it lands.
  requestToken++;
  lastOptimisticIsPlaying = isPlaying;
  optimisticGuardUntil = Date.now() + OPTIMISTIC_GUARD_MS;
  const optimistic = { ...lastState, isPlaying };
  lastState = optimistic;
  broadcastNowPlaying(optimistic);
}

/** Re-poll immediately (e.g. right after a play/pause/skip action) instead of waiting for the next tick. Returns the tick's promise so tests can await it; production call sites intentionally leave it unawaited. */
export function pollNow(): Promise<void> {
  if (timer) clearTimeout(timer);
  return tick();
}

/** The most recent poll's state, if any — lets a one-off read (e.g. opening Settings) reuse it instead of a fresh network round trip. */
export function getLastKnownState(): NowPlayingState | null {
  return lastState;
}

export function setPollingActive(active: boolean) {
  popupIsActive = active;
  applyInterval();
}

/** Call after the polling-speed setting changes so the currently running interval picks it up right away. */
export function refreshPollingSpeed() {
  applyInterval();
}
