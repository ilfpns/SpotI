import type { NowPlayingState } from "../../shared/types";
import { t, onLocaleChange } from "../i18nClient";
import { extractDominantColor } from "./dominantColor";
import { POPUP_DISC_SPIN_DEG_PER_SEC } from "../../shared/constants";

const ICON_HEART_OUTLINE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20.5s-7.5-4.6-10-9.3C.5 7.8 2.4 4.5 6 4.5c2.1 0 3.6 1.1 4.5 2.6.4.7 1.6.7 2 0C13.4 5.6 14.9 4.5 17 4.5c3.6 0 5.5 3.3 4 6.7-2.5 4.7-10 9.3-10 9.3z"/></svg>`;
const ICON_HEART_FILLED = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-7.5-4.6-10-9.3C.5 7.8 2.4 4.5 6 4.5c2.1 0 3.6 1.1 4.5 2.6.4.7 1.6.7 2 0C13.4 5.6 14.9 4.5 17 4.5c3.6 0 5.5 3.3 4 6.7-2.5 4.7-10 9.3-10 9.3z"/></svg>`;

export class TrackInfo {
  private discEl: HTMLElement;
  private discArtEl: HTMLElement | null = null;
  private metaEl: HTMLElement;
  private spinEnabled = true;
  private followNowPlayingColor = false;
  private colorExtractToken = 0;
  private spinDegPerSec = POPUP_DISC_SPIN_DEG_PER_SEC.normal;

  // Whether the *currently displayed* track is in the user's Spotify Liked
  // Songs — null while unknown (checked fresh, only, on track change; not
  // re-derived from anywhere else). savedCheckToken guards against a slower
  // check for a since-superseded track landing after a newer one's.
  private savedState: boolean | null = null;
  private savedCheckToken = 0;

  // Driven manually with rAF (rather than a CSS animation) so the disc can
  // stop exactly wherever it is on pause and pick back up from that same
  // angle on play, instead of resetting to 0deg every toggle.
  private discAngle = 0;
  private spinning = false;
  private lastFrameTime = 0;
  private rafHandle = 0;

  constructor(
    discContainer: HTMLElement,
    metaContainer: HTMLElement,
    private onFavoriteError: (error?: string) => void,
  ) {
    this.discEl = document.createElement("div");
    this.discEl.className = "disc-wrap";
    discContainer.appendChild(this.discEl);

    this.metaEl = document.createElement("div");
    this.metaEl.className = "meta";
    metaContainer.appendChild(this.metaEl);

    // Delegated (rather than bound per-render) since render() replaces the
    // title's innerHTML — including the heart button — on every call.
    this.metaEl.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action="favorite"]');
      if (!target || !this.lastState?.trackId) return;
      void this.toggleFavorite(this.lastState.trackId);
    });

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

    window.petAPI.getDiscSpinSpeed().then((speed) => {
      this.spinDegPerSec = POPUP_DISC_SPIN_DEG_PER_SEC[speed];
    });
    window.petAPI.onDiscSpinSpeedChanged((speed) => {
      this.spinDegPerSec = POPUP_DISC_SPIN_DEG_PER_SEC[speed];
    });

    window.petAPI.getFollowNowPlayingColor().then((enabled) => {
      this.followNowPlayingColor = enabled;
    });
    window.petAPI.onFollowNowPlayingColorChanged((enabled) => {
      this.followNowPlayingColor = enabled;
      // Turning it on should apply immediately to whatever's already
      // playing, not wait for the next track change.
      if (enabled && this.discArtEl?.tagName === "IMG") {
        this.scheduleColorExtract(this.discArtEl as HTMLImageElement);
      }
    });
  }

  /** Extracts the art's dominant color once it's loaded and applies it as the LP label color — a no-op if a newer track has already superseded this request. */
  private scheduleColorExtract(img: HTMLImageElement) {
    const token = ++this.colorExtractToken;
    const tryExtract = () => {
      if (token !== this.colorExtractToken) return;
      const color = extractDominantColor(img);
      if (color) window.petAPI.setLabelColor(color);
    };
    if (img.complete) tryExtract();
    else img.addEventListener("load", tryExtract, { once: true });
  }

  private lastState: NowPlayingState | null = null;

  private spinFrame = (now: number) => {
    if (!this.spinning || !this.discArtEl) return;
    if (this.lastFrameTime) {
      const deltaSec = (now - this.lastFrameTime) / 1000;
      this.discAngle = (this.discAngle + this.spinDegPerSec * deltaSec) % 360;
      this.discArtEl.style.transform = `rotate(${this.discAngle}deg)`;
    }
    this.lastFrameTime = now;
    this.rafHandle = requestAnimationFrame(this.spinFrame);
  };

  private setSpinning(next: boolean) {
    if (this.spinning === next) return;
    this.spinning = next;
    if (this.spinning) {
      this.lastFrameTime = 0;
      this.rafHandle = requestAnimationFrame(this.spinFrame);
    } else {
      cancelAnimationFrame(this.rafHandle);
    }
  }

  /** Fetches whether `trackId` is in Liked Songs, once per track change — a no-op if a newer track has already superseded this request by the time it resolves. */
  private async refreshSavedState(trackId: string) {
    const token = ++this.savedCheckToken;
    const result = await window.petAPI.spotify.isTrackSaved(trackId);
    if (token !== this.savedCheckToken) return;
    this.savedState = result.ok ? (result.data ?? false) : null;
    this.updateHeartIcon();
  }

  private updateHeartIcon() {
    const btn = this.metaEl.querySelector<HTMLButtonElement>('[data-action="favorite"]');
    if (!btn) return;
    const active = this.savedState === true;
    btn.classList.toggle("active", active);
    btn.innerHTML = active ? ICON_HEART_FILLED : ICON_HEART_OUTLINE;
  }

  /** Optimistically flips the heart, then confirms against Spotify — rolled back only if it fails and the same track is still displayed (a track change by then means the roll-back no longer applies to what's on screen). */
  private async toggleFavorite(trackId: string) {
    const nextSaved = this.savedState !== true;
    this.savedState = nextSaved;
    this.updateHeartIcon();
    const result = nextSaved
      ? await window.petAPI.spotify.saveTrack(trackId)
      : await window.petAPI.spotify.removeSavedTrack(trackId);
    if (!result.ok) {
      this.onFavoriteError(result.error);
      if (this.lastState?.trackId === trackId) {
        this.savedState = !nextSaved;
        this.updateHeartIcon();
      }
    }
  }

  render(state: NowPlayingState | null) {
    const previousTrackId = this.lastState?.trackId ?? null;
    this.lastState = state;

    // Reused in place (not recreated) so a plain play/pause toggle or a
    // track change never disturbs the rotation transform already applied —
    // only swap the element itself when img vs. placeholder-div actually
    // needs to change.
    const hasArt = !!state?.albumArtUrl;
    const currentIsImg = this.discArtEl?.tagName === "IMG";
    if (!this.discArtEl || hasArt !== currentIsImg) {
      this.discEl.innerHTML = hasArt ? `<img class="disc" alt="" crossorigin="anonymous" />` : `<div class="disc"></div>`;
      this.discArtEl = this.discEl.firstElementChild as HTMLElement;
      this.discArtEl.style.transform = `rotate(${this.discAngle}deg)`;
    }
    if (hasArt) {
      const imgEl = this.discArtEl as HTMLImageElement;
      const newSrc = state!.albumArtUrl!;
      if (imgEl.src !== newSrc) {
        imgEl.src = newSrc;
        if (this.followNowPlayingColor) this.scheduleColorExtract(imgEl);
      }
    }
    this.setSpinning(!!state?.isPlaying && this.spinEnabled);

    const heartMarkup = state?.trackId
      ? `<button class="heart-button" data-action="favorite" aria-label="${escapeHtml(t("popup.favorite"))}">${ICON_HEART_OUTLINE}</button>`
      : "";
    this.metaEl.innerHTML = state
      ? `
        <div class="title">
          <span class="title-scroll"><span class="title-text">${escapeHtml(state.title ?? t("popup.unknownTitle"))}</span></span>
          ${heartMarkup}
        </div>
        <div class="artist">${escapeHtml(state.artist ?? t("popup.unknownArtist"))}</div>
      `
      : `<div class="title"><span class="title-scroll"><span class="title-text">${escapeHtml(t("popup.nothingPlaying"))}</span></span></div>`;

    if (state?.trackId && state.trackId !== previousTrackId) {
      this.savedState = null;
      void this.refreshSavedState(state.trackId);
    } else if (state?.trackId) {
      this.updateHeartIcon();
    }

    requestAnimationFrame(() => this.setupMarquee());
  }

  /** Slides the title left-to-right instead of truncating when it's too wide to fit. Measured against .title-scroll (a real flex sibling of the heart button, sized to exclude it) rather than .title itself, so the scrolling text's available width never includes the heart's own space — a fixed-width reservation via padding wouldn't actually stop overflowing/animated content from painting into it, only flex's own per-item clipping does. */
  private setupMarquee() {
    const scrollEl = this.metaEl.querySelector(".title-scroll") as HTMLElement | null;
    const textEl = this.metaEl.querySelector(".title-text") as HTMLElement | null;
    if (!scrollEl || !textEl) return;

    const overflowPx = textEl.scrollWidth - scrollEl.clientWidth;
    if (overflowPx > 2) {
      scrollEl.style.setProperty("--marquee-distance", `-${overflowPx}px`);
      scrollEl.classList.add("marquee");
    } else {
      scrollEl.classList.remove("marquee");
      scrollEl.style.removeProperty("--marquee-distance");
    }
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
