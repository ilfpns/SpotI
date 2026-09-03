import type { BestTrack, DaySummary, HistorySummary } from "../../../shared/types";
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

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

// Caches getBestTrackForDay() lookups so re-hovering the same cell (very
// common while scanning across a row) doesn't re-fetch every time.
const bestTrackCache = new Map<string, BestTrack | null>();

async function getBestTrackCached(date: string): Promise<BestTrack | null> {
  if (bestTrackCache.has(date)) return bestTrackCache.get(date) ?? null;
  const best = await window.petAPI.getBestTrackForDay(date);
  bestTrackCache.set(date, best);
  return best;
}

class HeatmapTooltip {
  private el: HTMLElement;
  private requestId = 0;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "heatmap-tooltip";
    this.el.hidden = true;
    document.body.appendChild(this.el);
  }

  async show(cell: HTMLElement, date: string, totalMs: number) {
    const myRequest = ++this.requestId;
    const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      weekday: "short",
    });

    this.el.innerHTML = `
      <div class="heatmap-tooltip-date">${escapeHtml(dateLabel)}</div>
      <div class="heatmap-tooltip-duration">${formatDuration(totalMs)}</div>
    `;
    this.position(cell);
    this.el.hidden = false;

    const best = await getBestTrackCached(date);
    if (myRequest !== this.requestId) return; // a newer hover has already superseded this one

    if (best) {
      const art = best.albumArtUrl
        ? `<img class="heatmap-tooltip-art" src="${escapeHtml(best.albumArtUrl)}" alt="" />`
        : `<div class="heatmap-tooltip-art"></div>`;
      this.el.insertAdjacentHTML(
        "beforeend",
        `<div class="heatmap-tooltip-track">${art}<span>${escapeHtml(best.title ?? t("popup.unknownTitle"))}</span></div>`,
      );
      this.position(cell);
    }
  }

  hide() {
    this.requestId++;
    this.el.hidden = true;
  }

  private position(cell: HTMLElement) {
    const rect = cell.getBoundingClientRect();
    const tipRect = this.el.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    let top = rect.top - tipRect.height - 8;
    if (top < 8) top = rect.bottom + 8;
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }
}

function renderHeatmap2D(
  container: HTMLElement,
  days: DaySummary[],
  tooltip: HeatmapTooltip,
  onSelect: (date: string) => void,
) {
  container.innerHTML = "";
  for (const d of days) {
    const date = new Date(`${d.date}T00:00:00`);
    const dow = date.getDay(); // 0 = Sun .. 6 = Sat
    const cell = document.createElement("div");
    cell.className = "heatmap-cell";
    cell.style.gridRow = String(dow + 1);
    cell.style.background = `var(--heat-${levelFor(d.totalMs)})`;
    cell.dataset.date = d.date;
    cell.addEventListener("mouseenter", () => void tooltip.show(cell, d.date, d.totalMs));
    cell.addEventListener("mouseleave", () => tooltip.hide());
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

  const best = await getBestTrackCached(date);
  if (!best) {
    bodyEl.innerHTML = `<div class="history-best-track-time">${t("history.noListening")}</div>`;
    return;
  }

  const art = best.albumArtUrl
    ? `<img class="history-best-track-art" src="${escapeHtml(best.albumArtUrl)}" alt="" />`
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

export async function initHistoryPage() {
  const totalEl = document.getElementById("history-total") as HTMLElement;
  const weekEl = document.getElementById("history-week") as HTMLElement;
  const bestDayEl = document.getElementById("history-best-day") as HTMLElement;
  const averageEl = document.getElementById("history-average") as HTMLElement;
  const playCountEl = document.getElementById("history-play-count") as HTMLElement;
  const longestStreakEl = document.getElementById("history-longest-streak") as HTMLElement;
  const currentStreakEl = document.getElementById("history-current-streak") as HTMLElement;
  const grid2d = document.getElementById("history-heatmap-2d") as HTMLElement;
  const bestTrackTitleEl = document.getElementById("history-best-track-title") as HTMLElement;
  const bestTrackBodyEl = document.getElementById("history-best-track") as HTMLElement;
  const tooltip = new HeatmapTooltip();

  function renderStats(summary: HistorySummary) {
    totalEl.textContent = formatDuration(summary.totalMs);
    weekEl.textContent = formatDuration(summary.thisWeekMs);
    bestDayEl.textContent = summary.bestDay ? formatDuration(summary.bestDay.ms) : "—";
    averageEl.textContent = formatDuration(summary.averageMsPerDay);
    playCountEl.textContent = String(summary.playCount);
    longestStreakEl.textContent = `${summary.longestStreakDays}${t("history.days")}`;
    currentStreakEl.textContent = `${summary.currentStreakDays}${t("history.days")}`;
  }

  const thisYear = new Date().getFullYear();
  let selectedYear = thisYear;
  let selectedDate = todayKey();

  async function load() {
    bestTrackCache.clear();
    const summary = await window.petAPI.getHistorySummaryForYear(selectedYear);
    renderStats(summary);
    renderHeatmap2D(grid2d, summary.days, tooltip, (date) => {
      selectedDate = date;
      markSelected2D(grid2d, date);
      void showBestTrack(bestTrackTitleEl, bestTrackBodyEl, date);
    });
    markSelected2D(grid2d, selectedDate);
  }

  // GitHub-style year switcher for the heatmap card — a dropdown of every
  // year with at least one recorded day (plus the current one), reusing the
  // same .select markup/styling as the language picker.
  const yearWrap = document.getElementById("history-year-select") as HTMLElement;
  const yearTrigger = yearWrap.querySelector(".select-trigger") as HTMLButtonElement;
  const yearTriggerLabel = yearWrap.querySelector(".select-trigger-label") as HTMLElement;
  const yearMenu = yearWrap.querySelector(".select-menu") as HTMLElement;

  function renderYearMenu(years: number[]) {
    yearTriggerLabel.textContent = String(selectedYear);
    yearMenu.innerHTML = years
      .map(
        (y) => `
          <button class="select-option ${y === selectedYear ? "selected" : ""}" data-year="${y}">
            <span>${y}</span>
            ${y === selectedYear ? '<span class="option-check">✓</span>' : ""}
          </button>
        `,
      )
      .join("");
  }

  async function initYearSelect() {
    const years = await window.petAPI.getHistoryYears();

    yearTrigger.addEventListener("click", () => yearWrap.classList.toggle("open"));
    document.addEventListener("click", (e) => {
      if (!yearWrap.contains(e.target as Node)) yearWrap.classList.remove("open");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") yearWrap.classList.remove("open");
    });

    yearMenu.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-year]");
      if (!target) return;
      const year = Number(target.dataset.year);
      if (year === selectedYear) {
        yearWrap.classList.remove("open");
        return;
      }
      selectedYear = year;
      selectedDate = year === thisYear ? todayKey() : `${year}-12-31`;
      renderYearMenu(years);
      yearWrap.classList.remove("open");
      void load();
    });

    renderYearMenu(years);
  }

  onLocaleChange(load);
  await initYearSelect();
  await load();
  void showBestTrack(bestTrackTitleEl, bestTrackBodyEl, selectedDate);
}
