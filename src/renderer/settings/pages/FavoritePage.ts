import type { SavedTrack } from "../../../shared/types";
import { t } from "../../i18nClient";

const ICON_REMOVE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-7.5-4.6-10-9.3C.5 7.8 2.4 4.5 6 4.5c2.1 0 3.6 1.1 4.5 2.6.4.7 1.6.7 2 0C13.4 5.6 14.9 4.5 17 4.5c3.6 0 5.5 3.3 4 6.7-2.5 4.7-10 9.3-10 9.3z"/></svg>`;
const PAGE_SIZE = 20;

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export function initFavoritePage() {
  const listEl = document.getElementById("favorite-list") as HTMLElement;
  const emptyEl = document.getElementById("favorite-empty") as HTMLElement;
  const loadMoreButton = document.getElementById("favorite-load-more") as HTMLButtonElement;

  let offset = 0;
  let total = 0;
  let items: SavedTrack[] = [];
  // Bumped on every fresh load() so a slow in-flight page fetch can't land
  // after the list has already been reset (e.g. the tab was reopened while
  // a previous load was still pending).
  let loadToken = 0;

  function renderList() {
    listEl.innerHTML = items
      .map((track) => {
        const art = track.albumArtUrl
          ? `<img class="favorite-row-art" src="${escapeHtml(track.albumArtUrl)}" alt="" />`
          : `<div class="favorite-row-art"></div>`;
        return `
          <div class="favorite-row" data-track-id="${escapeHtml(track.trackId)}">
            ${art}
            <div class="favorite-row-meta">
              <div class="favorite-row-title">${escapeHtml(track.title ?? t("popup.unknownTitle"))}</div>
              <div class="favorite-row-artist">${escapeHtml(track.artist ?? t("popup.unknownArtist"))}</div>
            </div>
            <button class="favorite-remove-button" data-track-id="${escapeHtml(track.trackId)}" aria-label="${escapeHtml(t("favorite.remove"))}">${ICON_REMOVE}</button>
          </div>
        `;
      })
      .join("");
    emptyEl.hidden = items.length > 0;
    loadMoreButton.hidden = items.length >= total;
  }

  async function loadPage(reset: boolean) {
    const token = reset ? ++loadToken : loadToken;
    if (reset) offset = 0;
    const result = await window.petAPI.spotify.getSavedTracks(PAGE_SIZE, offset);
    if (token !== loadToken) return;
    if (!result.ok || !result.data) return;
    items = reset ? result.data.items : [...items, ...result.data.items];
    total = result.data.total;
    offset += result.data.items.length;
    renderList();
  }

  listEl.addEventListener("click", async (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>(".favorite-remove-button");
    if (!button?.dataset.trackId) return;
    const trackId = button.dataset.trackId;
    // Optimistic removal — reverted by a full reload if the API call fails.
    items = items.filter((t) => t.trackId !== trackId);
    total = Math.max(0, total - 1);
    renderList();
    const result = await window.petAPI.spotify.removeSavedTrack(trackId);
    if (!result.ok) void loadPage(true);
  });

  loadMoreButton.addEventListener("click", () => void loadPage(false));

  void loadPage(true);

  // Someone might favorite a track from the popup while Settings is already
  // open on this tab — a plain re-fetch on tab activation covers that
  // without needing a dedicated "favorited" broadcast.
  window.petAPI.onNavigateSettingsTab((tab) => {
    if (tab === "favorite") void loadPage(true);
  });
}
