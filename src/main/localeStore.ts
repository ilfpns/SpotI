import { app } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "../shared/i18n";

function filePath(): string {
  return join(app.getPath("userData"), "locale.json");
}

let cachedLocale: Locale | null = null;

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.some((l) => l.code === value);
}

export function getLocale(): Locale {
  if (cachedLocale) return cachedLocale;

  const path = filePath();
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf-8"));
      const value = parsed?.locale;
      if (isLocale(value)) {
        cachedLocale = value;
        return cachedLocale;
      }
    } catch {
      // fall through to default
    }
  }

  cachedLocale = DEFAULT_LOCALE;
  return cachedLocale;
}

export function setLocale(locale: Locale): void {
  cachedLocale = locale;
  writeFileSync(filePath(), JSON.stringify({ locale }));
}
