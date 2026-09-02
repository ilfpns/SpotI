import type { NowPlayingState } from "../../shared/types";
import { t, onLocaleChange } from "../i18nClient";

export class TrackInfo {
  private discEl: HTMLElement;
  private metaEl: HTMLElement;
  private spinEnabled = true;

  constructor(discContainer: HTMLElement, metaContainer: HTMLElement) {
    this.discEl = document.createElement("div");
    this.discEl.className = "disc-wrap";
    discContainer.appendChild(this.discEl);

    this.metaEl = document.createElement("div");
    this.metaEl.className = "meta";
    metaContainer.appendChild(this.metaEl);

    this.render(null);
    window.petAPI.spotify.onNowPlayingChanged((state) => this.render(state));
    onLocaleChange(() => this.render(this.lastState));

    window.petAPI.getSpinAnimation().then((enabled) => {
      this.spinEnabled = enabled;
      this.render(this.lastState);
    });
    window.petAPI.onSpinAnimationChanged((enabled) => {
      this.spinEnabled = enabled;
      this.render(this.lastState);
    });
  }

  private lastState: NowPlayingState | null = null;

  render(state: NowPlayingState | null) {
    this.lastState = state;
    const spinClass = state?.isPlaying && this.spinEnabled ? "spinning" : "";
    const art = state?.albumArtUrl
      ? `<img class="disc ${spinClass}" src="${state.albumArtUrl}" alt="" />`
      : `<div class="disc ${spinClass}"></div>`;
    this.discEl.innerHTML = art;

    this.metaEl.innerHTML = state
      ? `
        <div class="title"><span class="title-text">${escapeHtml(state.title ?? t("popup.unknownTitle"))}</span></div>
        <div class="artist">${escapeHtml(state.artist ?? t("popup.unknownArtist"))}</div>
      `
      : `<div class="title"><span class="title-text">${escapeHtml(t("popup.nothingPlaying"))}</span></div>`;

    requestAnimationFrame(() => this.setupMarquee());
  }

  /** Slides the title left-to-right instead of truncating when it's too wide to fit. */
  private setupMarquee() {
    const titleEl = this.metaEl.querySelector(".title") as HTMLElement | null;
    const textEl = this.metaEl.querySelector(".title-text") as HTMLElement | null;
    if (!titleEl || !textEl) return;

    const overflowPx = textEl.scrollWidth - titleEl.clientWidth;
    if (overflowPx > 2) {
      titleEl.style.setProperty("--marquee-distance", `-${overflowPx}px`);
      titleEl.classList.add("marquee");
    } else {
      titleEl.classList.remove("marquee");
      titleEl.style.removeProperty("--marquee-distance");
    }
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
