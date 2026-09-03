import { setupInteraction } from "./hitTest";
import { getPetSvgMarkup, BORDER_STROKE_WIDTH } from "../../shared/petSvg";

const petRoot = document.getElementById("pet-root") as HTMLElement;

const [initialLabelColor, initialCaseColor, initialShowBorder, initialBorderColor, initialDiscName] = await Promise.all([
  window.petAPI.getLabelColor(),
  window.petAPI.getCaseColor(),
  window.petAPI.getShowBorder(),
  window.petAPI.getBorderColor(),
  window.petAPI.getDiscName(),
]);
petRoot.innerHTML = getPetSvgMarkup(
  initialLabelColor,
  initialCaseColor,
  initialShowBorder,
  initialBorderColor,
  initialDiscName,
);
const petSvg = petRoot.querySelector("svg") as Element;

// Recolor/re-stroke in place rather than re-injecting the whole SVG, so the
// element reference hitTest() is already using never goes stale.
window.petAPI.onLabelColorChanged((color) => {
  document.getElementById("pet-label")?.setAttribute("fill", color);
});
window.petAPI.onCaseColorChanged((color) => {
  document.getElementById("pet-case")?.setAttribute("fill", color);
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

// Driven manually with rAF (rather than a CSS animation) so the disc can
// stop exactly wherever it is when the case slides back on, and pick back
// up from that same angle next time it's revealed — never snapping back to
// a fixed start position.
const discGroup = petRoot.querySelector("#pet-disc-group") as SVGGElement | null;
const SPIN_DEGREES_PER_SEC = 120;
let discAngle = 0;
let spinning = false;
let lastFrameTime = 0;
let rafHandle = 0;

function spinFrame(now: number) {
  if (!spinning || !discGroup) return;
  if (lastFrameTime) {
    const deltaSec = (now - lastFrameTime) / 1000;
    discAngle = (discAngle + SPIN_DEGREES_PER_SEC * deltaSec) % 360;
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
