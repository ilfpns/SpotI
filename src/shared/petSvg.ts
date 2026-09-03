import {
  DEFAULT_LABEL_COLOR,
  DEFAULT_CASE_COLOR,
  DEFAULT_SHOW_BORDER,
  DEFAULT_BORDER_COLOR,
  DEFAULT_DISC_NAME,
  DEFAULT_CASE_SHAPE,
  type CaseShape,
} from "./theme";

/**
 * "classic": a plain square sleeve (42x42, matching its own height). Its
 * right edge stays at x=39 — the disc's own horizontal center — so exactly
 * half the disc is still covered, same as the original (non-square)
 * design; the extra width needed to make it a true square is added on the
 * left instead, bleeding slightly past the icon's own left edge.
 *
 * "cut": a square exactly matching the disc's own bounding box (also
 * 42x42, centered on it) with the triangle D-O-C notched out — D and C are
 * its top-right/bottom-right corners, O is its own center — so the case
 * and LP fully coincide except through that one triangular window.
 */
export function casePathFor(shape: CaseShape): string {
  if (shape === "classic") return "M-1,3 L37,3 A2,2 0 0 1 39,5 L39,43 A2,2 0 0 1 37,45 L-1,45 A2,2 0 0 1 -3,43 L-3,5 A2,2 0 0 1 -1,3 Z";
  return "M20,3 L60,3 L39,24 L60,45 L20,45 A2,2 0 0 1 18,43 L18,5 A2,2 0 0 1 20,3 Z";
}

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
  caseShape: CaseShape = DEFAULT_CASE_SHAPE,
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
    <!-- The "cut" shape slices the case's top-right corner off along one
         big diagonal, like a torn/cut album sleeve, so the LP behind it
         shows through that whole cut rather than a small notch; "classic"
         is the original plain rounded rectangle. -->
    <path
      id="pet-case"
      d="${casePathFor(caseShape)}"
      fill="${caseColor}"
      stroke="${borderColor}"
      stroke-width="${borderWidth}"
      stroke-linejoin="round"
    />
    <!-- Positioned to stay on solid case material for both shapes — inside
         "cut"'s retained top wedge (above the D-O diagonal) as well as
         "classic"'s plain square. -->
    <text id="pet-disc-name" x="30" y="8" text-anchor="start" font-family="Arial, sans-serif" font-size="5.5" font-weight="700" letter-spacing="0.3" fill="${contrastTextColor(caseColor)}">${escapeXml(discName)}</text>
  </g>
</svg>
`.trim();
}
