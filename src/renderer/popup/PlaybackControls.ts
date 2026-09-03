import { t } from "../i18nClient";

const ICON_PREVIOUS = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 12l8-6v12zm-8 0l8-6v12z"/></svg>`;
const ICON_NEXT = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 12l-8-6v12zm8 0l-8-6v12z"/></svg>`;
const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`;
const ICON_SHUFFLE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>`;
const ICON_REPEAT = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>`;
const ICON_REPEAT_ONE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/><text x="12" y="14.5" font-size="7.5" text-anchor="middle" font-weight="700">1</text></svg>`;

type RepeatMode = "off" | "context" | "track";
const REPEAT_CYCLE: RepeatMode[] = ["off", "context", "track"];

export class PlaybackControls {
  private statusEl: HTMLElement;
  private playPauseButton: HTMLButtonElement;
  private shuffleButton: HTMLButtonElement;
  private repeatButton: HTMLButtonElement;

  constructor(container: HTMLElement) {
    const el = document.createElement("div");
    el.className = "controls";
    el.innerHTML = `
      <button class="control-btn" data-action="shuffle" aria-label="Shuffle">${ICON_SHUFFLE}</button>
      <button class="control-btn" data-action="previous" aria-label="Previous">${ICON_PREVIOUS}</button>
      <button class="control-btn control-btn-primary" data-action="playpause" aria-label="Play or pause">${ICON_PLAY}</button>
      <button class="control-btn" data-action="next" aria-label="Next">${ICON_NEXT}</button>
      <button class="control-btn" data-action="repeat" aria-label="Repeat">${ICON_REPEAT}</button>
    `;
    container.appendChild(el);

    this.playPauseButton = el.querySelector('[data-action="playpause"]')!;
    this.shuffleButton = el.querySelector('[data-action="shuffle"]')!;
    this.repeatButton = el.querySelector('[data-action="repeat"]')!;

    this.statusEl = document.createElement("div");
    this.statusEl.className = "status-message";
    this.statusEl.hidden = true;
    container.appendChild(this.statusEl);

    let isPlaying = false;
    let shuffleOn = false;
    let repeatMode: RepeatMode = "off";

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
      } else if (action === "shuffle") {
        const optimistic = !shuffleOn;
        shuffleOn = optimistic;
        this.shuffleButton.classList.toggle("active", shuffleOn);
        result = await window.petAPI.spotify.setShuffle(optimistic);
      } else if (action === "repeat") {
        const next = REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(repeatMode) + 1) % REPEAT_CYCLE.length];
        repeatMode = next;
        this.renderRepeat(next);
        result = await window.petAPI.spotify.setRepeat(next);
      }

      if (result && !result.ok) this.showError(result.error);
    });

    window.petAPI.spotify.onNowPlayingChanged((state) => {
      isPlaying = state?.isPlaying ?? false;
      this.playPauseButton.innerHTML = isPlaying ? ICON_PAUSE : ICON_PLAY;

      shuffleOn = state?.shuffleState ?? false;
      this.shuffleButton.classList.toggle("active", shuffleOn);

      repeatMode = state?.repeatState ?? "off";
      this.renderRepeat(repeatMode);
    });
  }

  private renderRepeat(mode: RepeatMode) {
    this.repeatButton.innerHTML = mode === "track" ? ICON_REPEAT_ONE : ICON_REPEAT;
    this.repeatButton.classList.toggle("active", mode !== "off");
  }

  showError(error?: string) {
    this.statusEl.textContent = t(`error.${error ?? "unknown_error"}`);
    this.statusEl.hidden = false;
    setTimeout(() => (this.statusEl.hidden = true), 3000);
  }
}
