import type { DaySummary, HistorySummary } from "../../../shared/types";
import { t, onLocaleChange } from "../../i18nClient";

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}${t("unit.hour")} ${minutes}${t("unit.minute")}`;
  return `${minutes}${t("unit.minute")}`;
}

function levelFor(ms: number): 0 | 1 | 2 | 3 | 4 {
  if (ms <= 0) return 0;
  if (ms < 15 * 60_000) return 1;
  if (ms < 30 * 60_000) return 2;
  if (ms < 60 * 60_000) return 3;
  return 4;
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function renderHeatmap2D(container: HTMLElement, days: DaySummary[], onSelect: (date: string) => void) {
  container.innerHTML = "";
  for (const d of days) {
    const date = new Date(`${d.date}T00:00:00`);
    const dow = date.getDay(); // 0 = Sun .. 6 = Sat
    const cell = document.createElement("div");
    cell.className = "heatmap-cell";
    cell.style.gridRow = String(dow + 1);
    cell.style.background = `var(--heat-${levelFor(d.totalMs)})`;
    cell.title = `${d.date} · ${formatDuration(d.totalMs)}`;
    cell.dataset.date = d.date;
    cell.addEventListener("click", () => onSelect(d.date));
    container.appendChild(cell);
  }
}

function markSelected2D(container: HTMLElement, date: string) {
  container.querySelectorAll<HTMLElement>(".heatmap-cell").forEach((cell) => {
    cell.classList.toggle("selected", cell.dataset.date === date);
  });
}

async function showBestTrack(titleEl: HTMLElement, bodyEl: HTMLElement, date: string) {
  const isToday = date === todayKey();
  titleEl.textContent = isToday ? t("history.bestTrack.today") : t("history.bestTrack.forDate").replace("{date}", date);

  const best = await window.petAPI.getBestTrackForDay(date);
  if (!best) {
    bodyEl.innerHTML = `<div class="history-best-track-time">${t("history.noListening")}</div>`;
    return;
  }

  const art = best.albumArtUrl
    ? `<img class="history-best-track-art" src="${best.albumArtUrl}" alt="" />`
    : `<div class="history-best-track-art"></div>`;

  bodyEl.innerHTML = `
    ${art}
    <div class="history-best-track-meta">
      <div class="history-best-track-title">${escapeHtml(best.title ?? t("popup.unknownTitle"))}</div>
      <div class="history-best-track-artist">${escapeHtml(best.artist ?? t("popup.unknownArtist"))}</div>
      <div class="history-best-track-time">${formatDuration(best.ms)}</div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export async function initHistoryPage() {
  const totalEl = document.getElementById("history-total") as HTMLElement;
  const weekEl = document.getElementById("history-week") as HTMLElement;
  const bestDayEl = document.getElementById("history-best-day") as HTMLElement;
  const averageEl = document.getElementById("history-average") as HTMLElement;
  const longestStreakEl = document.getElementById("history-longest-streak") as HTMLElement;
  const currentStreakEl = document.getElementById("history-current-streak") as HTMLElement;
  const grid2d = document.getElementById("history-heatmap-2d") as HTMLElement;
  const bestTrackTitleEl = document.getElementById("history-best-track-title") as HTMLElement;
  const bestTrackBodyEl = document.getElementById("history-best-track") as HTMLElement;

  function renderStats(summary: HistorySummary) {
    totalEl.textContent = formatDuration(summary.totalMs);
    weekEl.textContent = formatDuration(summary.thisWeekMs);
    bestDayEl.textContent = summary.bestDay ? formatDuration(summary.bestDay.ms) : "—";
    averageEl.textContent = formatDuration(summary.averageMsPerDay);
    longestStreakEl.textContent = `${summary.longestStreakDays}${t("history.days")}`;
    currentStreakEl.textContent = `${summary.currentStreakDays}${t("history.days")}`;
  }

  let selectedDate = todayKey();

  async function load() {
    const summary = await window.petAPI.getHistorySummary();
    renderStats(summary);
    renderHeatmap2D(grid2d, summary.days, (date) => {
      selectedDate = date;
      markSelected2D(grid2d, date);
      void showBestTrack(bestTrackTitleEl, bestTrackBodyEl, date);
    });
    markSelected2D(grid2d, selectedDate);
  }

  onLocaleChange(load);
  await load();
  void showBestTrack(bestTrackTitleEl, bestTrackBodyEl, selectedDate);
}
