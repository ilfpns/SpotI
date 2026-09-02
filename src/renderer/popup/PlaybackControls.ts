import { t } from "../i18nClient";

const ICON_PREVIOUS = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 12l8-6v12zm-8 0l8-6v12z"/></svg>`;
const ICON_NEXT = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 12l-8-6v12zm8 0l-8-6v12z"/></svg>`;
const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`;

export class PlaybackControls {
  private statusEl: HTMLElement;
  private playPauseButton: HTMLButtonElement;

  constructor(container: HTMLElement) {
    const el = document.createElement("div");
    el.className = "controls";
    el.innerHTML = `
      <button class="control-btn" data-action="previous" aria-label="Previous">${ICON_PREVIOUS}</button>
      <button class="control-btn control-btn-primary" data-action="playpause" aria-label="Play or pause">${ICON_PLAY}</button>
      <button class="control-btn" data-action="next" aria-label="Next">${ICON_NEXT}</button>
    `;
    container.appendChild(el);

    this.playPauseButton = el.querySelector('[data-action="playpause"]')!;

    this.statusEl = document.createElement("div");
    this.statusEl.className = "status-message";
    this.statusEl.hidden = true;
    container.appendChild(this.statusEl);

    let isPlaying = false;

    el.addEventListener("click", async (e) => {
      const target = (e.target as HTMLElement).closest("button");
      if (!target) return;
      const action = target.getAttribute("data-action");

      let result;
      if (action === "previous") result = await window.petAPI.spotify.previous();
      else if (action === "next") result = await window.petAPI.spotify.next();
      else if (action === "playpause") {
        // Flip the icon immediately rather than waiting on the network round
        // trip — the next poll (kicked off right after the API call
        // resolves) reconciles it with whatever Spotify actually did.
        const optimisticPlaying = !isPlaying;
        isPlaying = optimisticPlaying;
        this.playPauseButton.innerHTML = optimisticPlaying ? ICON_PAUSE : ICON_PLAY;
        result = optimisticPlaying ? await window.petAPI.spotify.play() : await window.petAPI.spotify.pause();
      }

      if (result && !result.ok) this.showError(result.error);
    });

    window.petAPI.spotify.onNowPlayingChanged((state) => {
      isPlaying = state?.isPlaying ?? false;
      this.playPauseButton.innerHTML = isPlaying ? ICON_PAUSE : ICON_PLAY;
    });
  }

  private showError(error?: string) {
    this.statusEl.textContent = t(`error.${error ?? "unknown_error"}`);
    this.statusEl.hidden = false;
    setTimeout(() => (this.statusEl.hidden = true), 3000);
  }
}
