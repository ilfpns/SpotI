import { globalShortcut } from "electron";
import * as spotifyApiClient from "./spotify/spotifyApiClient";
import { pollNow, getLastKnownState } from "./spotify/pollingService";
import { getMediaKeysEnabled } from "./appSettingsStore";

const KEYS = ["MediaPlayPause", "MediaNextTrack", "MediaPreviousTrack"] as const;

async function togglePlayPause() {
  // Reuses the polling loop's already-cached state instead of a fresh
  // network round trip just to read isPlaying — falls back to a live
  // fetch only for the rare case a key is pressed before the first poll.
  const cached = getLastKnownState();
  let isPlaying: boolean;
  if (cached) {
    isPlaying = cached.isPlaying;
  } else {
    const result = await spotifyApiClient.getNowPlaying();
    isPlaying = result.ok && !!result.data?.isPlaying;
  }
  await (isPlaying ? spotifyApiClient.pause() : spotifyApiClient.play());
  pollNow();
}

/** Binds the hardware media keys system-wide (works even when SpotI isn't focused — it never is, being click-through). */
export function registerMediaKeys(): void {
  if (!getMediaKeysEnabled()) return;
  if (globalShortcut.isRegistered("MediaPlayPause")) return;

  globalShortcut.register("MediaPlayPause", () => void togglePlayPause());
  globalShortcut.register("MediaNextTrack", () => void spotifyApiClient.next().then(() => pollNow()));
  globalShortcut.register("MediaPreviousTrack", () => void spotifyApiClient.previous().then(() => pollNow()));
}

export function unregisterMediaKeys(): void {
  for (const key of KEYS) globalShortcut.unregister(key);
}

/** Call after the media-keys setting changes so it takes effect immediately. */
export function refreshMediaKeys(): void {
  unregisterMediaKeys();
  registerMediaKeys();
}
