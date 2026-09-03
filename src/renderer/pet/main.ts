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

// The case-slide transition duration is user-configurable (Settings ->
// Animation) — the stylesheet's own duration is just the "normal" default,
// overridden here via inline style once the real setting is known.
const caseGroup = petRoot.querySelector("#pet-case-group") as SVGGElement | null;
function applyCaseSlideDuration(speed: CaseSlideSpeed) {
  if (caseGroup) caseGroup.style.transitionDuration = `${CASE_SLIDE_DURATION_MS[speed]}ms`;
}
window.petAPI.getCaseSlideSpeed().then(applyCaseSlideDuration);
window.petAPI.onCaseSlideSpeedChanged(applyCaseSlideDuration);

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

setupInteraction(
  petSvg,
  () => {
    /* no animation state to switch while actually dragging — the SVG is a static shape */
  },
  () => {
    // A plain click (no drag) slides the sleeve fully off (revealing the
    // whole LP, and starting it spinning) — click again to slide it back on
    // (freezing the disc where it is).
    const revealed = petRoot.classList.toggle("revealed");
    setSpinning(revealed);
  },
);
