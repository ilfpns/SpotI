import type { DaySummary, HistorySummary } from "../../../shared/types";
import { t, onLocaleChange } from "../../i18nClient";
import { createSegmented } from "../uiControls";

type HeatmapView = "2d" | "3d" | "both";

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

const BAR_HEIGHT_BY_LEVEL = [2, 10, 18, 26, 34];

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

// Isometric bar chart drawn on canvas rather than with CSS 3D transforms —
// the projection math is exact and doesn't depend on cross-browser 3D
// transform-style quirks, and it's far cheaper than ~2000 transformed DOM
// nodes for a rarely-opened settings panel.
function drawHeatmap3D(canvas: HTMLCanvasElement, days: DaySummary[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const style = getComputedStyle(document.documentElement);
  const colors = [0, 1, 2, 3, 4].map((lvl) => style.getPropertyValue(`--heat-${lvl}`).trim());

  const TILE_W = 10;
  const TILE_H = 6;
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;

  // Bucket days into (week column, weekday row) the same way the 2D grid does.
  const first = new Date(`${days[0]?.date ?? todayKey()}T00:00:00`);
  const firstDow = first.getDay();
  const tiles = days.map((d, i) => {
    const col = Math.floor((i + firstDow) / 7);
    const row = new Date(`${d.date}T00:00:00`).getDay();
    return { col, row, totalMs: d.totalMs, date: d.date };
  });
  const maxCol = tiles.reduce((m, t2) => Math.max(m, t2.col), 0);

  const width = (maxCol + 1) * hw + 7 * hw + 40;
  const height = (maxCol + 7) * hh + 60;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const originX = 40 + 6 * hw;
  const originY = 40;

  const sorted = [...tiles].sort((a, b) => a.col + a.row - (b.col + b.row));
  for (const tile of sorted) {
    const level = levelFor(tile.totalMs);
    const color = colors[level];
    const barHeight = BAR_HEIGHT_BY_LEVEL[level];

    const cx = originX + (tile.col - tile.row) * hw;
    const groundY = originY + (tile.col + tile.row) * hh;
    const topY = groundY - barHeight;

    const top = { x: cx, y: topY - hh };
    const right = { x: cx + hw, y: topY };
    const bottom = { x: cx, y: topY + hh };
    const left = { x: cx - hw, y: topY };

    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(left.x, left.y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    if (barHeight > 0) {
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(bottom.x, bottom.y);
      ctx.lineTo(bottom.x, bottom.y + barHeight);
      ctx.lineTo(left.x, left.y + barHeight);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(right.x, right.y);
      ctx.lineTo(bottom.x, bottom.y);
      ctx.lineTo(bottom.x, bottom.y + barHeight);
      ctx.lineTo(right.x, right.y + barHeight);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.48)";
      ctx.fill();
    }
  }
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
  const container2d = document.getElementById("history-heatmap-2d-container") as HTMLElement;
  const container3d = document.getElementById("history-heatmap-3d-container") as HTMLElement;
  const canvas3d = document.getElementById("history-heatmap-3d-canvas") as HTMLCanvasElement;
  const viewSegmented = document.getElementById("history-view-segmented") as HTMLElement;
  const bestTrackTitleEl = document.getElementById("history-best-track-title") as HTMLElement;
  const bestTrackBodyEl = document.getElementById("history-best-track") as HTMLElement;
  const clearButton = document.getElementById("clear-history-button") as HTMLButtonElement;

  function renderStats(summary: HistorySummary) {
    totalEl.textContent = formatDuration(summary.totalMs);
    weekEl.textContent = formatDuration(summary.thisWeekMs);
    bestDayEl.textContent = summary.bestDay ? formatDuration(summary.bestDay.ms) : "—";
    averageEl.textContent = formatDuration(summary.averageMsPerDay);
    longestStreakEl.textContent = `${summary.longestStreakDays}${t("history.days")}`;
    currentStreakEl.textContent = `${summary.currentStreakDays}${t("history.days")}`;
  }

  function applyView(view: HeatmapView) {
    container2d.hidden = view === "3d";
    container3d.hidden = view === "2d";
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
    drawHeatmap3D(canvas3d, summary.days);
  }

  createSegmented<HeatmapView>(
    viewSegmented,
    [
      { value: "2d", labelKey: "history.view.2d" },
      { value: "3d", labelKey: "history.view.3d" },
      { value: "both", labelKey: "history.view.both" },
    ],
    "2d",
    applyView,
  );
  applyView("2d");

  window.petAPI.onUiThemeChanged(async () => {
    const summary = await window.petAPI.getHistorySummary();
    drawHeatmap3D(canvas3d, summary.days);
  });

  onLocaleChange(load);
  await load();
  void showBestTrack(bestTrackTitleEl, bestTrackBodyEl, selectedDate);

  clearButton.addEventListener("click", async () => {
    if (!window.confirm(t("confirm.clearHistory"))) return;
    await window.petAPI.clearHistory();
    await load();
    void showBestTrack(bestTrackTitleEl, bestTrackBodyEl, selectedDate);
  });
}
