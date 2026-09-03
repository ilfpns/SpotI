import { setupInteraction } from "./hitTest";
import { getPetSvgMarkup, BORDER_STROKE_WIDTH } from "../../shared/petSvg";

const petRoot = document.getElementById("pet-root") as HTMLElement;

const [initialLabelColor, initialCaseColor, initialShowBorder, initialBorderColor] = await Promise.all([
  window.petAPI.getLabelColor(),
  window.petAPI.getCaseColor(),
  window.petAPI.getShowBorder(),
  window.petAPI.getBorderColor(),
]);
petRoot.innerHTML = getPetSvgMarkup(initialLabelColor, initialCaseColor, initialShowBorder, initialBorderColor);
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

setupInteraction(petSvg, () => {
  /* no animation state to switch — the SVG is a static shape */
});
