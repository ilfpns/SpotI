import type { NowPlayingState } from "../../shared/types";
import { t } from "../i18nClient";

const TICK_MS = 250;

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export class ProgressBar {
  private fillEl: HTMLElement;
  private thumbEl: HTMLElement;
  private trackEl: HTMLElement;
  private elapsedEl: HTMLElement;
  private totalEl: HTMLElement;
  private wrapperEl: HTMLElement;
  private statusEl: HTMLElement;

  private durationMs = 0;
  private baseProgressMs = 0;
  private baseTimestamp = 0;
  private isPlaying = false;
  private dragging = false;

  constructor(container: HTMLElement) {
    this.wrapperEl = document.createElement("div");
    this.wrapperEl.className = "progress";
    this.wrapperEl.innerHTML = `
      <div class="progress-track"><div class="progress-fill"></div><div class="progress-thumb"></div></div>
      <div class="progress-times">
        <span class="progress-time elapsed">0:00</span>
        <span class="progress-time total">0:00</span>
      </div>
    `;
    container.appendChild(this.wrapperEl);

    this.trackEl = this.wrapperEl.querySelector(".progress-track")!;
    this.fillEl = this.wrapperEl.querySelector(".progress-fill")!;
    this.thumbEl = this.wrapperEl.querySelector(".progress-thumb")!;
    this.elapsedEl = this.wrapperEl.querySelector(".elapsed")!;
    this.totalEl = this.wrapperEl.querySelector(".total")!;

    this.statusEl = document.createElement("div");
    this.statusEl.className = "status-message";
    this.statusEl.hidden = true;
    container.appendChild(this.statusEl);

    this.setupSeeking();

    window.petAPI.spotify.onNowPlayingChanged((state) => this.sync(state));
    setInterval(() => this.tick(), TICK_MS);
  }

  private setupSeeking() {
    const ratioAt = (clientX: number): number => {
      const rect = this.trackEl.getBoundingClientRect();
      if (rect.width === 0) return 0;
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    };

    this.trackEl.addEventListener("pointerdown", (e) => {
      if (!this.durationMs) return;
      this.dragging = true;
      this.trackEl.classList.add("dragging");
      this.trackEl.setPointerCapture(e.pointerId);
      this.render(ratioAt(e.clientX) * this.durationMs);
    });

    this.trackEl.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.render(ratioAt(e.clientX) * this.durationMs);
    });

    const endDrag = async (e: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.trackEl.classList.remove("dragging");
      try {
        this.trackEl.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }

      const targetMs = ratioAt(e.clientX) * this.durationMs;
      // Keep showing the dragged-to position immediately; the next poll
      // (kicked off right after the API call resolves) reconciles it.
      this.baseProgressMs = targetMs;
      this.baseTimestamp = Date.now();
      const result = await window.petAPI.spotify.seek(targetMs);
      if (!result.ok) this.showError(result.error);
    };

    this.trackEl.addEventListener("pointerup", endDrag);
  }

  private sync(state: NowPlayingState | null) {
    if (this.dragging) return;

    if (!state || !state.durationMs || state.progressMs === null) {
      this.durationMs = 0;
      this.isPlaying = false;
      this.totalEl.textContent = "0:00";
      this.render(0);
      return;
    }
    this.durationMs = state.durationMs;
    this.baseProgressMs = state.progressMs;
    this.baseTimestamp = Date.now();
    this.isPlaying = state.isPlaying;
    this.totalEl.textContent = formatTime(this.durationMs);
    this.render(this.baseProgressMs);
  }

  private tick() {
    if (this.dragging || !this.isPlaying) return;
    const elapsed = Date.now() - this.baseTimestamp;
    const progress = Math.min(this.durationMs, this.baseProgressMs + elapsed);
    this.render(progress);
  }

  private render(progressMs: number) {
    const pct = this.durationMs ? Math.min(100, (progressMs / this.durationMs) * 100) : 0;
    this.fillEl.style.width = `${pct}%`;
    this.thumbEl.style.left = `${pct}%`;
    this.elapsedEl.textContent = formatTime(progressMs);
  }

  private showError(error?: string) {
    this.statusEl.textContent = t(`error.${error ?? "unknown_error"}`);
    this.statusEl.hidden = false;
    setTimeout(() => (this.statusEl.hidden = true), 3000);
  }
}
