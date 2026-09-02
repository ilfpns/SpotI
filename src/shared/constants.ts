export const SPOTIFY_REDIRECT_PORT = 8765;
export const SPOTIFY_REDIRECT_URI = `http://127.0.0.1:${SPOTIFY_REDIRECT_PORT}/callback`;

export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
].join(" ");

export const POLL_INTERVAL_IDLE_MS = 3_000;

export type PollingSpeed = "fast" | "normal";
export const POLLING_INTERVAL_ACTIVE_MS: Record<PollingSpeed, number> = {
  fast: 200,
  normal: 1_000,
};
export const DEFAULT_POLLING_SPEED: PollingSpeed = "fast";

export type PetSize = "small" | "medium" | "large";
export const PET_SIZE_PX: Record<PetSize, number> = {
  small: 48,
  medium: 64,
  large: 88,
};
export const DEFAULT_PET_SIZE: PetSize = "medium";

export type HoverDelay = "fast" | "normal" | "slow";
export const POPUP_DISMISS_DELAY_MS: Record<HoverDelay, number> = {
  fast: 30,
  normal: 60,
  slow: 150,
};
export const DEFAULT_HOVER_DELAY: HoverDelay = "normal";

/** How many trailing days the listening-history heatmap covers (52 weeks). */
export const HISTORY_DAYS_WINDOW = 364;
