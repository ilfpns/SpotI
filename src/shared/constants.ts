export const SPOTIFY_REDIRECT_PORT = 8765;
export const SPOTIFY_REDIRECT_URI = `http://127.0.0.1:${SPOTIFY_REDIRECT_PORT}/callback`;

export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
].join(" ");

export type PollingSpeed = "fast" | "normal";
export const POLLING_INTERVAL_ACTIVE_MS: Record<PollingSpeed, number> = {
  fast: 200,
  normal: 1_000,
};
export const DEFAULT_POLLING_SPEED: PollingSpeed = "fast";

export type PetSize = "small" | "medium" | "large" | "max";
export const PET_SIZE_PX: Record<PetSize, number> = {
  small: 48,
  medium: 64,
  large: 88,
  max: 176, // 2x large
};
export const DEFAULT_PET_SIZE: PetSize = "medium";

export type HoverDelay = "fast" | "normal" | "slow";
export const POPUP_DISMISS_DELAY_MS: Record<HoverDelay, number> = {
  fast: 30,
  normal: 60,
  slow: 150,
};
export const DEFAULT_HOVER_DELAY: HoverDelay = "normal";

/** How fast the case slides open/closed. */
export type CaseSlideSpeed = "slow" | "normal" | "fast";
export const CASE_SLIDE_DURATION_MS: Record<CaseSlideSpeed, number> = {
  slow: 550,
  normal: 380,
  fast: 220,
};
export const DEFAULT_CASE_SLIDE_SPEED: CaseSlideSpeed = "normal";

/** The LP's steady-state rotation rate, in degrees/second — the pet's own small disc and the popup's larger album-art disc keep separate base rates (the popup was always slower, to read as a real turntable) but move together under one setting. */
export type DiscSpinSpeed = "slow" | "normal" | "fast";
export const PET_DISC_SPIN_DEG_PER_SEC: Record<DiscSpinSpeed, number> = {
  slow: 60,
  normal: 120,
  fast: 220,
};
export const POPUP_DISC_SPIN_DEG_PER_SEC: Record<DiscSpinSpeed, number> = {
  slow: 9,
  normal: 18,
  fast: 33,
};
export const DEFAULT_DISC_SPIN_SPEED: DiscSpinSpeed = "normal";
