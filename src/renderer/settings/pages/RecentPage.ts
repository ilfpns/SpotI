import type { RecentPlay, TopAlbum } from "../../../shared/types";
import { t, getCurrentLocale, onLocaleChange } from "../../i18nClient";

const RECENT_LIMIT = 10;
const TOP_ALBUMS_LIMIT = 10;

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}${t("unit.hour")} ${minutes}${t("unit.minute")}`;
  return `${minutes}${t("unit.minute")}`;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

/** "{n} {unit} ago" via Intl for automatic localization — floored at 1 minute rather than passing 0, since RelativeTimeFormat.format(0, "minute") reads as a broken half-phrase ("현재 분") rather than anything meaning "just now". */
function formatRelativeTime(playedAt: number): string {
  const diffMs = playedAt - Date.now(); // negative — playedAt is in the past
  const rtf = new Intl.RelativeTimeFormat(getCurrentLocale(), { numeric: "auto" });
  for (const [unit, unitMs] of RELATIVE_UNITS) {
    const value = Math.round(diffMs / unitMs);
    if (Math.abs(value) >= 1) return rtf.format(value, unit);
  }
  return rtf.format(-1, "minute");
}

function renderRecentList(
  container: HTMLElement,
  emptyEl: HTMLElement,
  items: RecentPlay[],
  nowPlayingTrackId: string | null,
) {
  container.innerHTML = items
    .map((play, i) => {
      const art = play.albumArtUrl
        ? `<img class="recent-row-art" src="${escapeHtml(play.albumArtUrl)}" alt="" />`
        : `<div class="recent-row-art"></div>`;
      // Only the newest entry (index 0) can be "now playing" — matching by
      // trackId alone would also relabel an older play of the same track
      // further down the list if it happens to be looping right now.
      const timeLabel =
        i === 0 && play.trackId === nowPlayingTrackId ? t("recent.nowPlaying") : formatRelativeTime(play.playedAt);
      return `
        <div class="recent-row">
          ${art}
          <div class="recent-row-meta">
            <div class="recent-row-title">${escapeHtml(play.title ?? t("popup.unknownTitle"))}</div>
            <div class="recent-row-artist">${escapeHtml(play.artist ?? t("popup.unknownArtist"))}</div>
          </div>
          <div class="recent-row-time">${escapeHtml(timeLabel)}</div>
        </div>
      `;
    })
    .join("");
  emptyEl.hidden = items.length > 0;
}

function renderTopAlbums(container: HTMLElement, emptyEl: HTMLElement, albums: TopAlbum[]) {
  container.innerHTML = albums
    .map((album, i) => {
      const art = album.albumArtUrl
        ? `<img class="top-album-art" src="${escapeHtml(album.albumArtUrl)}" alt="" />`
        : `<div class="top-album-art"></div>`;
      return `
        <div class="top-album-card">
          <div class="top-album-art-wrap">
            ${art}
            <div class="top-album-rank">${i + 1}</div>
          </div>
          <div class="top-album-name">${escapeHtml(album.albumName ?? t("popup.unknownTitle"))}</div>
          <div class="top-album-artist">${escapeHtml(album.artist ?? t("popup.unknownArtist"))}</div>
          <div class="top-album-time">${formatDuration(album.ms)}</div>
        </div>
      `;
    })
    .join("");
  emptyEl.hidden = albums.length > 0;
}

export async function initRecentPage() {
  const recentListEl = document.getElementById("recent-list") as HTMLElement;
  const recentEmptyEl = document.getElementById("recent-empty") as HTMLElement;
  const topAlbumsGridEl = document.getElementById("top-albums-grid") as HTMLElement;
  const topAlbumsEmptyEl = document.getElementById("top-albums-empty") as HTMLElement;

  let lastRecent: RecentPlay[] = [];
  let lastTopAlbums: TopAlbum[] = [];
  let nowPlayingTrackId: string | null = null;

  function renderRecent() {
    renderRecentList(recentListEl, recentEmptyEl, lastRecent, nowPlayingTrackId);
  }

  async function load() {
    const [recent, topAlbums, nowPlaying] = await Promise.all([
      window.petAPI.getRecentlyPlayed(RECENT_LIMIT),
      window.petAPI.getTopAlbumsForWeek(TOP_ALBUMS_LIMIT),
      window.petAPI.spotify.getNowPlaying(),
    ]);
    lastRecent = recent;
    lastTopAlbums = topAlbums;
    nowPlayingTrackId = nowPlaying?.isPlaying ? nowPlaying.trackId : null;
    renderRecent();
    renderTopAlbums(topAlbumsGridEl, topAlbumsEmptyEl, lastTopAlbums);
  }

  // Keeps the "now playing" label current while Settings stays open —
  // doesn't re-fetch the lists themselves, just re-renders with the
  // latest known trackId/isPlaying.
  window.petAPI.spotify.onNowPlayingChanged((state) => {
    nowPlayingTrackId = state?.isPlaying ? state.trackId : null;
    renderRecent();
  });

  // Locale change re-renders with the same data (relative-time wording and
  // duration units depend on locale) rather than re-fetching.
  onLocaleChange(() => {
    renderRecent();
    renderTopAlbums(topAlbumsGridEl, topAlbumsEmptyEl, lastTopAlbums);
  });

  await load();
}
