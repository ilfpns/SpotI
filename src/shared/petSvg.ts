import { DEFAULT_LABEL_COLOR, DEFAULT_CASE_COLOR, DEFAULT_SHOW_BORDER, DEFAULT_BORDER_COLOR, DEFAULT_DISC_NAME } from "./theme";

/** Stroke width used for both the case's and the LP's outline when borders are shown. */
export const BORDER_STROKE_WIDTH = 1;

/** discName is a sanitized-but-untrusted string (allows & " ') — escape before it lands inside SVG text content. */
function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;");
}

/** Picks readable text over an arbitrary user-chosen case color, since it's not fixed like the disc's own base fill. */
export function contrastTextColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "rgba(255,255,255,0.85)";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "rgba(20,20,20,0.8)" : "rgba(255,255,255,0.85)";
}

/**
 * The pet's artwork as raw SVG markup — a single source of truth shared by
 * the pet renderer (injected into the DOM) and the main process (rasterized
 * once into a window/tray icon), so the icon never drifts from the actual
 * on-screen pet design. The LP's center label, the sleeve/case, whether
 * either shows its outline stroke, that stroke's color, and the disc's own
 * printed name are all user-themeable — see shared/theme.ts — everything
 * else is fixed.
 */
export function getPetSvgMarkup(
  labelColor: string = DEFAULT_LABEL_COLOR,
  caseColor: string = DEFAULT_CASE_COLOR,
  showBorder: boolean = DEFAULT_SHOW_BORDER,
  borderColor: string = DEFAULT_BORDER_COLOR,
  discName: string = DEFAULT_DISC_NAME,
): string {
  const borderWidth = showBorder ? BORDER_STROKE_WIDTH : 0;
  return `
<svg id="pet-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <!-- The disc's diameter equals the sleeve's height and shares its
       vertical center, so the two are exactly height-matched and
       aligned. The disc (and so its center label/hole too) is centered
       exactly on the sleeve's right edge, so both are exactly half
       covered. -->
  <defs>
    <clipPath id="pet-disc-clip">
      <circle cx="39" cy="24" r="21" />
    </clipPath>
  </defs>
  <!-- grouped so the whole disc — base, grooves, border, light streak,
       label and center hole — spins together as one unit while the case
       is off. -->
  <g id="pet-disc-group">
    <circle cx="39" cy="24" r="21" fill="#141414" />
    <!-- faint concentric grooves, like real vinyl — several thin rings
         rather than one flat fill. -->
    <circle cx="39" cy="24" r="18.5" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.4" />
    <circle cx="39" cy="24" r="16.5" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.4" />
    <circle cx="39" cy="24" r="14.5" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.4" />
    <circle cx="39" cy="24" r="12.5" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.4" />
    <circle cx="39" cy="24" r="10.5" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.4" />
    <circle id="pet-disc-border" cx="39" cy="24" r="21" fill="none" stroke="${borderColor}" stroke-width="${borderWidth}" />
    <!-- a soft diagonal glint fanned out of a few thin strokes rather than
         one flat gradient bar, like light catching the grooves. -->
    <g clip-path="url(#pet-disc-clip)" id="pet-disc-shine">
      <line x1="33" y1="4" x2="52" y2="32" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" opacity="0.08" />
      <line x1="30" y1="6" x2="46" y2="29" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" opacity="0.16" />
      <line x1="27.5" y1="8.5" x2="40" y2="27" stroke="#ffffff" stroke-width="0.9" stroke-linecap="round" opacity="0.24" />
    </g>
    <circle id="pet-label" cx="39" cy="24" r="7" fill="${labelColor}" />
    <circle cx="39" cy="24" r="2" fill="#141414" />
  </g>
  <!-- sleeve, drawn on top so the disc reads as sliding out from behind it —
       grouped with its own printed name so the text slides off together
       with the case rather than staying behind on the disc. -->
  <g id="pet-case-group">
    <rect id="pet-case" x="3" y="3" width="36" height="42" rx="2" fill="${caseColor}" stroke="${borderColor}" stroke-width="${borderWidth}" />
    <text id="pet-disc-name" x="21" y="26" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="5.5" font-weight="700" letter-spacing="0.3" fill="${contrastTextColor(caseColor)}">${escapeXml(discName)}</text>
  </g>
</svg>
`.trim();
}

/** Default-colored markup, for places that don't yet know the user's theme. */
export const PET_SVG_MARKUP = getPetSvgMarkup();
