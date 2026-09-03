import { app } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { BestTrack, DaySummary, HistorySummary } from "../shared/types";
import { HISTORY_DAYS_WINDOW } from "../shared/constants";

// Keep some slack past the heatmap's own display window so a day just past
// it doesn't get pruned mid-query, but still bound how much the file (and
// the in-memory cache kept alive for the app's whole session) can grow —
// otherwise every day of every track ever played stays in RAM forever.
const RETENTION_DAYS = HISTORY_DAYS_WINDOW + 30;

interface TrackBucket {
  title: string | null;
  artist: string | null;
  albumArtUrl: string | null;
  ms: number;
}

interface DayBucket {
  totalMs: number;
  tracks: Record<string, TrackBucket>;
}

interface StoredHistory {
  days: Record<string, DayBucket>;
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
      cached = { days: parsed?.days && typeof parsed.days === "object" ? parsed.days : {} };
      pruneOldDays(cached);
      return cached;
    } catch {
      // fall through to an empty store
    }
  }

  cached = { days: {} };
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
  const track = (day.tracks[trackId] ??= { title, artist, albumArtUrl, ms: 0 });
  track.ms += deltaMs;
  track.title = title;
  track.artist = artist;
  track.albumArtUrl = albumArtUrl;
  scheduleFlush();
}

function daySummaries(days: number): DaySummary[] {
  const store = load();
  const result: DaySummary[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    result.push({ date: key, totalMs: store.days[key]?.totalMs ?? 0 });
  }
  return result;
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

export function getHistorySummary(days: number): HistorySummary {
  const summaries = daySummaries(days);

  const totalMs = summaries.reduce((sum, d) => sum + d.totalMs, 0);
  const thisWeekMs = summaries.slice(-7).reduce((sum, d) => sum + d.totalMs, 0);

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

  return { days: summaries, totalMs, thisWeekMs, bestDay, averageMsPerDay, longestStreakDays, currentStreakDays };
}
