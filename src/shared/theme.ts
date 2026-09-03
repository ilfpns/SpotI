/** The LP's center label default color. */
export const DEFAULT_LABEL_COLOR = "#22c55e";

/** The sleeve/case default color. */
export const DEFAULT_CASE_COLOR = "#595d64";

/** Default popup/UI accent text color. */
export const DEFAULT_FONT_COLOR = "#ffffff";

/** Seven classic rainbow presets shown before the custom color wheel. */
export const RAINBOW_PRESETS: string[] = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#4338ca", // indigo
  "#a855f7", // violet
];

/** The resolved theme actually applied to a window's `data-theme`. */
export type UiTheme = "dark" | "light";
/** The user's stored preference — "system" defers to the OS's own setting. */
export type UiThemePreference = UiTheme | "system";
export const DEFAULT_UI_THEME: UiThemePreference = "dark";

/** Whether the case and LP each show their thin outline stroke. */
export const DEFAULT_SHOW_BORDER = true;

/** The case's and LP's outline stroke color. */
export const DEFAULT_BORDER_COLOR = "#2e2e2e";

/** Optional custom text printed near the top of the LP, English + basic symbols only. */
export const DEFAULT_DISC_NAME = "";
export const DISC_NAME_MAX_LENGTH = 7;
const DISC_NAME_ALLOWED_CHARS = /[^A-Za-z0-9 !?.,'"&#@_-]/g;

/** Strips disallowed characters and truncates to the max length — the single source of truth for both the store's guard and the settings input's live filtering. */
export function sanitizeDiscName(value: string): string {
  return value.replace(DISC_NAME_ALLOWED_CHARS, "").slice(0, DISC_NAME_MAX_LENGTH);
}
