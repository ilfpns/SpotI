import { app, nativeTheme } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  DEFAULT_LABEL_COLOR,
  DEFAULT_CASE_COLOR,
  DEFAULT_FONT_COLOR,
  DEFAULT_UI_THEME,
  DEFAULT_SHOW_BORDER,
  DEFAULT_BORDER_COLOR,
  DEFAULT_DISC_NAME,
  sanitizeDiscName,
  DEFAULT_CASE_SHAPE,
  type UiTheme,
  type UiThemePreference,
  type CaseShape,
} from "../shared/theme";

interface StoredTheme {
  labelColor: string;
  caseColor: string;
  fontColor: string;
  uiTheme: UiThemePreference;
  showBorder: boolean;
  borderColor: string;
  discName: string;
  followNowPlayingColor: boolean;
  // The LP color from just before "follow now-playing color" was last
  // turned on, so turning it back off can restore it instead of leaving
  // the LP stuck on whatever track it last extracted from.
  preFollowLabelColor: string | null;
  caseShape: CaseShape;
}

function filePath(): string {
  return join(app.getPath("userData"), "theme.json");
}

let cached: StoredTheme | null = null;

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function isUiTheme(value: unknown): value is UiThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function isCaseShape(value: unknown): value is CaseShape {
  return value === "classic" || value === "cut";
}

function load(): StoredTheme {
  if (cached) return cached;

  const path = filePath();
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf-8"));
      cached = {
        labelColor: isHexColor(parsed?.labelColor) ? parsed.labelColor : DEFAULT_LABEL_COLOR,
        caseColor: isHexColor(parsed?.caseColor) ? parsed.caseColor : DEFAULT_CASE_COLOR,
        fontColor: isHexColor(parsed?.fontColor) ? parsed.fontColor : DEFAULT_FONT_COLOR,
        uiTheme: isUiTheme(parsed?.uiTheme) ? parsed.uiTheme : DEFAULT_UI_THEME,
        showBorder: typeof parsed?.showBorder === "boolean" ? parsed.showBorder : DEFAULT_SHOW_BORDER,
        borderColor: isHexColor(parsed?.borderColor) ? parsed.borderColor : DEFAULT_BORDER_COLOR,
        discName: typeof parsed?.discName === "string" ? sanitizeDiscName(parsed.discName) : DEFAULT_DISC_NAME,
        followNowPlayingColor:
          typeof parsed?.followNowPlayingColor === "boolean" ? parsed.followNowPlayingColor : false,
        preFollowLabelColor: isHexColor(parsed?.preFollowLabelColor) ? parsed.preFollowLabelColor : null,
        caseShape: isCaseShape(parsed?.caseShape) ? parsed.caseShape : DEFAULT_CASE_SHAPE,
      };
      return cached;
    } catch {
      // fall through to defaults
    }
  }

  cached = {
    labelColor: DEFAULT_LABEL_COLOR,
    caseColor: DEFAULT_CASE_COLOR,
    fontColor: DEFAULT_FONT_COLOR,
    uiTheme: DEFAULT_UI_THEME,
    showBorder: DEFAULT_SHOW_BORDER,
    borderColor: DEFAULT_BORDER_COLOR,
    discName: DEFAULT_DISC_NAME,
    followNowPlayingColor: false,
    preFollowLabelColor: null,
    caseShape: DEFAULT_CASE_SHAPE,
  };
  return cached;
}

function persist(): void {
  writeFileSync(filePath(), JSON.stringify(cached));
}

export function getLabelColor(): string {
  return load().labelColor;
}
export function setLabelColor(color: string): void {
  if (!isHexColor(color)) return;
  load().labelColor = color;
  persist();
}

export function getCaseColor(): string {
  return load().caseColor;
}
export function setCaseColor(color: string): void {
  if (!isHexColor(color)) return;
  load().caseColor = color;
  persist();
}

export function getFontColor(): string {
  return load().fontColor;
}
export function setFontColor(color: string): void {
  if (!isHexColor(color)) return;
  load().fontColor = color;
  persist();
}

export function getUiTheme(): UiThemePreference {
  return load().uiTheme;
}
export function setUiTheme(theme: UiThemePreference): void {
  if (!isUiTheme(theme)) return;
  load().uiTheme = theme;
  persist();
}

/** The preference resolved to an actual dark/light value, following the OS setting when the preference is "system". */
export function getEffectiveUiTheme(): UiTheme {
  const pref = getUiTheme();
  if (pref !== "system") return pref;
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

export function getShowBorder(): boolean {
  return load().showBorder;
}
export function setShowBorder(value: boolean): void {
  load().showBorder = value;
  persist();
}

export function getBorderColor(): string {
  return load().borderColor;
}
export function setBorderColor(color: string): void {
  if (!isHexColor(color)) return;
  load().borderColor = color;
  persist();
}

export function getDiscName(): string {
  return load().discName;
}
export function setDiscName(name: string): void {
  load().discName = sanitizeDiscName(name);
  persist();
}

export function getFollowNowPlayingColor(): boolean {
  return load().followNowPlayingColor;
}
export function setFollowNowPlayingColor(value: boolean): void {
  load().followNowPlayingColor = value;
  persist();
}

export function getPreFollowLabelColor(): string | null {
  return load().preFollowLabelColor;
}
export function setPreFollowLabelColor(color: string | null): void {
  if (color !== null && !isHexColor(color)) return;
  load().preFollowLabelColor = color;
  persist();
}

export function getCaseShape(): CaseShape {
  return load().caseShape;
}
export function setCaseShape(shape: CaseShape): void {
  if (!isCaseShape(shape)) return;
  load().caseShape = shape;
  persist();
}
