import { app } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  DEFAULT_LABEL_COLOR,
  DEFAULT_CASE_COLOR,
  DEFAULT_FONT_COLOR,
  DEFAULT_UI_THEME,
  DEFAULT_SHOW_BORDER,
  DEFAULT_BORDER_COLOR,
  type UiTheme,
} from "../shared/theme";

interface StoredTheme {
  labelColor: string;
  caseColor: string;
  fontColor: string;
  uiTheme: UiTheme;
  showBorder: boolean;
  borderColor: string;
}

function filePath(): string {
  return join(app.getPath("userData"), "theme.json");
}

let cached: StoredTheme | null = null;

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function isUiTheme(value: unknown): value is UiTheme {
  return value === "light" || value === "dark";
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

export function getUiTheme(): UiTheme {
  return load().uiTheme;
}
export function setUiTheme(theme: UiTheme): void {
  if (!isUiTheme(theme)) return;
  load().uiTheme = theme;
  persist();
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
