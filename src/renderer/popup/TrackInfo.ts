import type { NowPlayingState } from "../../shared/types";
import { t, onLocaleChange } from "../i18nClient";
import { extractDominantColor } from "./dominantColor";

// One full rotation every 20s (18deg/sec) — matches the original CSS
// animation's pace.
const SPIN_DEGREES_PER_SEC = 18;

export class TrackInfo {
  private discEl: HTMLElement;
  private discArtEl: HTMLElement | null = null;
  private metaEl: HTMLElement;
  private spinEnabled = true;
  private followNowPlayingColor = false;
  private colorExtractToken = 0;

  // Driven manually with rAF (rather than a CSS animation) so the disc can
  // stop exactly wherever it is on pause and pick back up from that same
  // angle on play, instead of resetting to 0deg every toggle.
  private discAngle = 0;
  private spinning = false;
  private lastFrameTime = 0;
  private rafHandle = 0;

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
      this.discAngle = (this.discAngle + SPIN_DEGREES_PER_SEC * deltaSec) % 360;
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

  render(state: NowPlayingState | null) {
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
