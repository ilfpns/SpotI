import { app } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { BestTrack, DaySummary, HistorySummary, RecentPlay, TopAlbum } from "../shared/types";

// The per-year heatmap view (see getHistorySummaryForYear) needs several
// years of history to actually have years to switch between — still
// bounded, so a day of every track ever played doesn't stay in RAM forever.
const RETENTION_DAYS = 5 * 365 + 30;

// How many entries the "recently played" feed keeps — well past the 10 the
// UI shows, so scrolling further back (if ever added) has real data, but
// still bounded.
const RECENT_PLAYS_LIMIT = 100;

interface TrackBucket {
  title: string | null;
  artist: string | null;
  albumArtUrl: string | null;
  albumId: string | null;
  albumName: string | null;
  ms: number;
  /** How many times this specific track started playing this day — optional on read since days recorded before this field existed won't have it. */
  playCount?: number;
}

interface DayBucket {
  totalMs: number;
  /** How many times a track *started* playing this day (distinct from totalMs, which measures duration) — optional on read since days recorded before this field existed won't have it. */
  playCount?: number;
  tracks: Record<string, TrackBucket>;
}

interface StoredHistory {
  days: Record<string, DayBucket>;
  /** Newest first — capped to RECENT_PLAYS_LIMIT. Optional on read for stores saved before this field existed. */
  recentPlays?: RecentPlay[];
}

function filePath(): string {
  return join(app.getPath("userData"), "history.json");
}

let cached: StoredHistory | null = null;
let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Date keys are zero-padded YYYY-MM-DD, so lexicographic comparison is also
// chronological comparison.
function pruneOldDays(store: StoredHistory): void {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffKey = dateKey(cutoff);
  for (const key of Object.keys(store.days)) {
    if (key < cutoffKey) delete store.days[key];
  }
}

function load(): StoredHistory {
  if (cached) return cached;

  const path = filePath();
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf-8"));
      const recentPlays: RecentPlay[] = Array.isArray(parsed?.recentPlays) ? parsed.recentPlays : [];
      cached = {
        days: parsed?.days && typeof parsed.days === "object" ? parsed.days : {},
        // One-time cleanup for adjacent-duplicate rows written before the
        // recordTrackStart() de-dup guard existed.
        recentPlays: recentPlays.filter((p, i) => i === 0 || p.trackId !== recentPlays[i - 1].trackId),
      };
      pruneOldDays(cached);
      return cached;
    } catch {
      // fall through to an empty store
    }
  }

  cached = { days: {}, recentPlays: [] };
  return cached;
}

function writeToDisk(): void {
  if (!cached) return;
  writeFileSync(filePath(), JSON.stringify(cached));
  dirty = false;
}

// Batches writes instead of hitting disk on every tick — at most one write
// every few seconds while music is actively playing.
function scheduleFlush(): void {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    writeToDisk();
  }, 5_000);
}

/** Flush any pending write immediately — call on app quit so the last few seconds aren't lost. */
export function flushHistoryNow(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (dirty) writeToDisk();
}

export function recordListening(
  trackId: string,
  title: string | null,
  artist: string | null,
  albumArtUrl: string | null,
  albumId: string | null,
  albumName: string | null,
  deltaMs: number,
): void {
  if (deltaMs <= 0) return;
  const store = load();
  const key = dateKey(new Date());
  const isNewDay = !store.days[key];
  const day = (store.days[key] ??= { totalMs: 0, tracks: {} });
  // Only worth checking once per new day (e.g. right after midnight) rather
  // than on every tick — a long-running session should still stay bounded.
  if (isNewDay) pruneOldDays(store);
  day.totalMs += deltaMs;
  const track = (day.tracks[trackId] ??= { title, artist, albumArtUrl, albumId, albumName, ms: 0 });
  track.ms += deltaMs;
  track.title = title;
  track.artist = artist;
  track.albumArtUrl = albumArtUrl;
  track.albumId = albumId;
  track.albumName = albumName;
  scheduleFlush();
}

/** Call once per genuine track change while playing (not on every poll tick) — see pollingService's own trackChanged detection, which this reuses. Also appends to the recently-played feed. */
export function recordTrackStart(
  trackId: string,
  title: string | null,
  artist: string | null,
  albumArtUrl: string | null,
  albumId: string | null,
  albumName: string | null,
): void {
  const store = load();
  const key = dateKey(new Date());
  const isNewDay = !store.days[key];
  const day = (store.days[key] ??= { totalMs: 0, playCount: 0, tracks: {} });
  if (isNewDay) pruneOldDays(store);
  day.playCount = (day.playCount ?? 0) + 1;
  const track = (day.tracks[trackId] ??= { title, artist, albumArtUrl, albumId, albumName, ms: 0, playCount: 0 });
  track.playCount = (track.playCount ?? 0) + 1;
  track.title = title;
  track.artist = artist;
  track.albumArtUrl = albumArtUrl;
  track.albumId = albumId;
  track.albumName = albumName;

  const recentPlays = (store.recentPlays ??= []);
  // A track briefly switching away and back (a quick skip-and-return, or
  // Spotify's own state blipping to something else for one poll) still
  // counts as a genuine trackChanged twice — but showing the same song
  // twice back-to-back in a "recently played" feed reads as a bug, not
  // useful history, so only the timestamp on the existing top entry moves
  // rather than adding a second row for it.
  if (recentPlays[0]?.trackId === trackId) {
    recentPlays[0] = { trackId, title, artist, albumArtUrl, playedAt: Date.now() };
  } else {
    recentPlays.unshift({ trackId, title, artist, albumArtUrl, playedAt: Date.now() });
    if (recentPlays.length > RECENT_PLAYS_LIMIT) recentPlays.length = RECENT_PLAYS_LIMIT;
  }

  scheduleFlush();
}

/** Most recent plays, newest first. */
export function getRecentlyPlayed(limit: number): RecentPlay[] {
  const store = load();
  return (store.recentPlays ?? []).slice(0, limit);
}

/** Albums ranked by total listening time over the last 7 days (today inclusive), grouped by albumId across every track credited to them. */
export function getTopAlbumsForWeek(limit: number): TopAlbum[] {
  const store = load();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  const cutoffKey = dateKey(cutoff);

  const byAlbum = new Map<string, TopAlbum>();
  for (const [dayKey, day] of Object.entries(store.days)) {
    if (dayKey < cutoffKey) continue;
    for (const track of Object.values(day.tracks)) {
      if (!track.albumId) continue;
      const existing = byAlbum.get(track.albumId);
      if (existing) {
        existing.ms += track.ms;
      } else {
        byAlbum.set(track.albumId, {
          albumId: track.albumId,
          albumName: track.albumName,
          artist: track.artist,
          albumArtUrl: track.albumArtUrl,
          ms: track.ms,
        });
      }
    }
  }

  return [...byAlbum.values()].sort((a, b) => b.ms - a.ms).slice(0, limit);
}

// Jan 1 through Dec 31 of the given year — or through today, for the
// current year, since there's no listening data for the future.
function daySummariesForYear(year: number): DaySummary[] {
  const store = load();
  const today = new Date();
  const isCurrentYear = year === today.getFullYear();
  const end = isCurrentYear ? today : new Date(year, 11, 31);

  const result: DaySummary[] = [];
  const d = new Date(year, 0, 1);
  while (d <= end) {
    const key = dateKey(d);
    result.push({ date: key, totalMs: store.days[key]?.totalMs ?? 0, playCount: store.days[key]?.playCount ?? 0 });
    d.setDate(d.getDate() + 1);
  }
  return result;
}

/** Calendar years worth offering in a year switcher — every year with at least one recorded day, plus the current year even if it's still empty. */
export function getHistoryYears(): number[] {
  const store = load();
  const years = new Set<number>([new Date().getFullYear()]);
  for (const key of Object.keys(store.days)) {
    years.add(Number(key.slice(0, 4)));
  }
  return [...years].sort((a, b) => b - a);
}

export function getBestTrackForDay(date: string): BestTrack | null {
  const store = load();
  const day = store.days[date];
  if (!day) return null;

  let best: BestTrack | null = null;
  for (const [trackId, t] of Object.entries(day.tracks)) {
    if (!best || t.ms > best.ms) {
      best = { trackId, title: t.title, artist: t.artist, albumArtUrl: t.albumArtUrl, ms: t.ms };
    }
  }
  return best;
}

function summarize(summaries: DaySummary[]): HistorySummary {
  const totalMs = summaries.reduce((sum, d) => sum + d.totalMs, 0);
  const thisWeekMs = summaries.slice(-7).reduce((sum, d) => sum + d.totalMs, 0);
  const playCount = summaries.reduce((sum, d) => sum + d.playCount, 0);

  let bestDay: { date: string; ms: number } | null = null;
  for (const d of summaries) {
    if (d.totalMs > 0 && (!bestDay || d.totalMs > bestDay.ms)) bestDay = { date: d.date, ms: d.totalMs };
  }

  const activeDays = summaries.filter((d) => d.totalMs > 0).length;
  const averageMsPerDay = activeDays > 0 ? Math.round(totalMs / activeDays) : 0;

  let longestStreakDays = 0;
  let running = 0;
  for (const d of summaries) {
    if (d.totalMs > 0) {
      running++;
      longestStreakDays = Math.max(longestStreakDays, running);
    } else {
      running = 0;
    }
  }

  let currentStreakDays = 0;
  for (let i = summaries.length - 1; i >= 0; i--) {
    if (summaries[i].totalMs > 0) currentStreakDays++;
    else break;
  }

  return { days: summaries, totalMs, thisWeekMs, bestDay, averageMsPerDay, longestStreakDays, currentStreakDays, playCount };
}

export function getHistorySummaryForYear(year: number): HistorySummary {
  return summarize(daySummariesForYear(year));
}
