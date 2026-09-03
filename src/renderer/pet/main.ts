import { setupInteraction } from "./hitTest";
import { getPetSvgMarkup, BORDER_STROKE_WIDTH, contrastTextColor, casePathFor } from "../../shared/petSvg";
import { PET_DISC_SPIN_DEG_PER_SEC, CASE_SLIDE_DURATION_MS, type CaseSlideSpeed } from "../../shared/constants";

const petRoot = document.getElementById("pet-root") as HTMLElement;

const [initialLabelColor, initialCaseColor, initialShowBorder, initialBorderColor, initialDiscName, initialCaseShape] =
  await Promise.all([
    window.petAPI.getLabelColor(),
    window.petAPI.getCaseColor(),
    window.petAPI.getShowBorder(),
    window.petAPI.getBorderColor(),
    window.petAPI.getDiscName(),
    window.petAPI.getCaseShape(),
  ]);
petRoot.innerHTML = getPetSvgMarkup(
  initialLabelColor,
  initialCaseColor,
  initialShowBorder,
  initialBorderColor,
  initialDiscName,
  initialCaseShape,
);
const petSvg = petRoot.querySelector("svg") as Element;

// Recolor/re-stroke in place rather than re-injecting the whole SVG, so the
// element reference hitTest() is already using never goes stale.
window.petAPI.onLabelColorChanged((color) => {
  document.getElementById("pet-label")?.setAttribute("fill", color);
});
window.petAPI.onCaseColorChanged((color) => {
  document.getElementById("pet-case")?.setAttribute("fill", color);
  document.getElementById("pet-disc-name")?.setAttribute("fill", contrastTextColor(color));
});
window.petAPI.onShowBorderChanged((show) => {
  const width = String(show ? BORDER_STROKE_WIDTH : 0);
  document.getElementById("pet-case")?.setAttribute("stroke-width", width);
  document.getElementById("pet-disc-border")?.setAttribute("stroke-width", width);
});
window.petAPI.onBorderColorChanged((color) => {
  document.getElementById("pet-case")?.setAttribute("stroke", color);
  document.getElementById("pet-disc-border")?.setAttribute("stroke", color);
});
window.petAPI.onDiscNameChanged((name) => {
  const el = document.getElementById("pet-disc-name");
  if (el) el.textContent = name;
});
window.petAPI.onCaseShapeChanged((shape) => {
  document.getElementById("pet-case")?.setAttribute("d", casePathFor(shape));
});

// The case-slide duration is user-configurable (Settings -> Animation) —
// the stylesheet's own keyframe animations just default to "normal",
// overridden here via inline style once the real setting is known.
const caseGroup = petRoot.querySelector("#pet-case-group") as SVGGElement | null;
function applyCaseSlideDuration(speed: CaseSlideSpeed) {
  if (caseGroup) caseGroup.style.animationDuration = `${CASE_SLIDE_DURATION_MS[speed]}ms`;
}
window.petAPI.getCaseSlideSpeed().then(applyCaseSlideDuration);
window.petAPI.onCaseSlideSpeedChanged(applyCaseSlideDuration);

// Swaps which keyframe animation is applied (away vs. home — see
// index.html) rather than relying on a plain CSS transition, since the
// slide is a bent "right, then down" path rather than a straight line.
// Removing both classes and forcing a reflow before adding the new one
// lets this restart cleanly even if clicked again mid-animation.
function setCaseRevealed(revealed: boolean) {
  if (!caseGroup) return;
  caseGroup.classList.remove("case-animate-away", "case-animate-home");
  void caseGroup.getBoundingClientRect(); // force a reflow so the animation restarts
  caseGroup.classList.add(revealed ? "case-animate-away" : "case-animate-home");
}

// Driven manually with rAF (rather than a CSS animation) so the disc can
// stop exactly wherever it is when the case slides back on, and pick back
// up from that same angle next time it's revealed — never snapping back to
// a fixed start position.
const discGroup = petRoot.querySelector("#pet-disc-group") as SVGGElement | null;

let baseSpinDegPerSec = PET_DISC_SPIN_DEG_PER_SEC.normal;
window.petAPI.getDiscSpinSpeed().then((speed) => {
  baseSpinDegPerSec = PET_DISC_SPIN_DEG_PER_SEC[speed];
});
window.petAPI.onDiscSpinSpeedChanged((speed) => {
  baseSpinDegPerSec = PET_DISC_SPIN_DEG_PER_SEC[speed];
});

// Each reveal gives the disc a "flick" — it starts noticeably faster than
// the configured steady rate and decays smoothly down to it over about a
// second, instead of snapping straight to a constant speed.
const SPIN_UP_MULTIPLIER = 4;
const SPIN_UP_DECAY_SECONDS = 1.1;

let discAngle = 0;
let spinning = false;
let lastFrameTime = 0;
let spinStartTime = 0;
let rafHandle = 0;

function spinFrame(now: number) {
  if (!spinning || !discGroup) return;
  if (lastFrameTime) {
    const deltaSec = (now - lastFrameTime) / 1000;
    const elapsedSec = (now - spinStartTime) / 1000;
    const decay = Math.exp(-elapsedSec / SPIN_UP_DECAY_SECONDS);
    const currentRate = baseSpinDegPerSec * (1 + (SPIN_UP_MULTIPLIER - 1) * decay);
    discAngle = (discAngle + currentRate * deltaSec) % 360;
    discGroup.style.transform = `rotate(${discAngle}deg)`;
  }
  lastFrameTime = now;
  rafHandle = requestAnimationFrame(spinFrame);
}

function setSpinning(next: boolean) {
  if (spinning === next) return;
  spinning = next;
  if (spinning) {
    lastFrameTime = 0;
    spinStartTime = performance.now();
    rafHandle = requestAnimationFrame(spinFrame);
  } else {
    cancelAnimationFrame(rafHandle);
  }
}

let revealed = false;

/** Updates the case/spin visuals to match `next`, but only if it's actually a change — called both from clicks and from real playback-state updates, so it must stay idempotent. */
function applyRevealed(next: boolean) {
  if (next === revealed) return;
  revealed = next;
  setCaseRevealed(revealed);
  setSpinning(revealed);
}

// The case's open/closed state mirrors actual playback, not just clicks —
// if the track gets paused/resumed from anywhere else (the popup, a media
// key, another device entirely), the pet's case follows along on the next
// poll instead of drifting out of sync with what's really playing.
window.petAPI.spotify.onNowPlayingChanged((state) => {
  applyRevealed(!!state?.isPlaying);
});

setupInteraction(
  petSvg,
  () => {
    /* no animation state to switch while actually dragging — the SVG is a static shape */
  },
  () => {
    // A plain click (no drag) slides the sleeve fully off (revealing the
    // whole LP, and starting it spinning) — click again to slide it back on
    // (freezing the disc where it is). Optimistically flips the visual
    // state immediately and fires the matching play/pause call; the
    // onNowPlayingChanged listener above reconciles it with whatever
    // actually happened on the next poll (same optimistic-update pattern
    // the popup's own controls use). Fire-and-forget — with nothing
    // connected/no active device this just silently no-ops, same as every
    // other playback control in that situation.
    applyRevealed(!revealed);
    void (revealed ? window.petAPI.spotify.play() : window.petAPI.spotify.pause());
  },
);
