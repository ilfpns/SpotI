export type SpotifyErrorCode =
  | "not_authenticated"
  | "premium_required"
  | "no_active_device"
  | "rate_limited"
  | "network_error"
  | "unknown_error";

export interface SpotifyResult<T> {
  ok: boolean;
  data?: T;
  error?: SpotifyErrorCode;
  message?: string;
}

export interface NowPlayingState {
  isPlaying: boolean;
  trackId: string | null;
  title: string | null;
  artist: string | null;
  albumArtUrl: string | null;
  progressMs: number | null;
  durationMs: number | null;
  shuffleState: boolean;
  repeatState: "off" | "context" | "track";
  volumePercent: number | null;
}

export interface AuthStatus {
  authenticated: boolean;
  displayName: string | null;
}

export interface DaySummary {
  /** YYYY-MM-DD, local date. */
  date: string;
  totalMs: number;
  playCount: number;
}

export interface BestTrack {
  trackId: string;
  title: string | null;
  artist: string | null;
  albumArtUrl: string | null;
  ms: number;
}

export interface HistorySummary {
  /** Chronological, oldest first. */
  days: DaySummary[];
  totalMs: number;
  thisWeekMs: number;
  bestDay: { date: string; ms: number } | null;
  averageMsPerDay: number;
  longestStreakDays: number;
  currentStreakDays: number;
  /** Number of distinct times a track started playing (a track-change landing on a poll while playing) — not the same as totalMs, which measures duration rather than play count. */
  playCount: number;
}

export interface SavedTrack {
  trackId: string;
  title: string | null;
  artist: string | null;
  albumArtUrl: string | null;
  /** ISO timestamp from Spotify's own record of when the track was saved. */
  addedAt: string;
}

export interface SavedTracksPage {
  items: SavedTrack[];
  total: number;
  limit: number;
  offset: number;
}
