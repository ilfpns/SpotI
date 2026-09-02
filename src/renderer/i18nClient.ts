import { translate, type Locale } from "../shared/i18n";

let currentLocale: Locale = "ko";
const listeners = new Set<() => void>();

/** Call once per renderer entry point before building any UI that uses t(). */
export async function initI18n(): Promise<void> {
  currentLocale = await window.petAPI.getLocale();
  window.petAPI.onLocaleChanged((locale) => {
    currentLocale = locale;
    listeners.forEach((cb) => cb());
  });
}

export function t(key: string): string {
  return translate(currentLocale, key);
}

export function getCurrentLocale(): Locale {
  return currentLocale;
}

/** Re-render static text that isn't already re-rendered by some other event. */
export function onLocaleChange(cb: () => void): void {
  listeners.add(cb);
}
