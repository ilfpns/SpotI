import { DEFAULT_LABEL_COLOR, DEFAULT_CASE_COLOR, DEFAULT_SHOW_BORDER, DEFAULT_BORDER_COLOR } from "./theme";

/** Stroke width used for both the case's and the LP's outline when borders are shown. */
export const BORDER_STROKE_WIDTH = 1;

/**
 * The pet's artwork as raw SVG markup — a single source of truth shared by
 * the pet renderer (injected into the DOM) and the main process (rasterized
 * once into a window/tray icon), so the icon never drifts from the actual
 * on-screen pet design. The LP's center label, the sleeve/case, whether
 * either shows its outline stroke, and that stroke's color are all
 * user-themeable — see shared/theme.ts — everything else is fixed.
 */
export function getPetSvgMarkup(
  labelColor: string = DEFAULT_LABEL_COLOR,
  caseColor: string = DEFAULT_CASE_COLOR,
  showBorder: boolean = DEFAULT_SHOW_BORDER,
  borderColor: string = DEFAULT_BORDER_COLOR,
): string {
  const borderWidth = showBorder ? BORDER_STROKE_WIDTH : 0;
  return `
<svg id="pet-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <!-- The disc's diameter equals the sleeve's height and shares its
       vertical center, so the two are exactly height-matched and
       aligned. The disc (and so its center label/hole too) is centered
       exactly on the sleeve's right edge, so both are exactly half
       covered. -->
  <circle cx="39" cy="24" r="21" fill="#141414" />
  <circle id="pet-disc-border" cx="39" cy="24" r="21" fill="none" stroke="${borderColor}" stroke-width="${borderWidth}" />
  <circle id="pet-label" cx="39" cy="24" r="7" fill="${labelColor}" />
  <circle cx="39" cy="24" r="2" fill="#141414" />
  <!-- sleeve, drawn on top so the disc reads as sliding out from behind it -->
  <rect id="pet-case" x="3" y="3" width="36" height="42" rx="2" fill="${caseColor}" stroke="${borderColor}" stroke-width="${borderWidth}" />
</svg>
`.trim();
}

/** Default-colored markup, for places that don't yet know the user's theme. */
export const PET_SVG_MARKUP = getPetSvgMarkup();
