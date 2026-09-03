import { app } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  DEFAULT_PET_SIZE,
  DEFAULT_POLLING_SPEED,
  DEFAULT_HOVER_DELAY,
  type PetSize,
  type PollingSpeed,
  type HoverDelay,
} from "../shared/constants";

interface StoredSettings {
  petSize: PetSize;
  notifyTrackChange: boolean;
  pollingSpeed: PollingSpeed;
  hoverDelay: HoverDelay;
  spinAnimation: boolean;
  mediaKeysEnabled: boolean;
  notificationSound: boolean;
  startHidden: boolean;
  opacity: number;
}

const DEFAULTS: StoredSettings = {
  petSize: DEFAULT_PET_SIZE,
  notifyTrackChange: true,
  pollingSpeed: DEFAULT_POLLING_SPEED,
  hoverDelay: DEFAULT_HOVER_DELAY,
  spinAnimation: true,
  mediaKeysEnabled: true,
  notificationSound: true,
  startHidden: false,
  opacity: 100,
};

function filePath(): string {
  return join(app.getPath("userData"), "settings.json");
}

let cached: StoredSettings | null = null;

function load(): StoredSettings {
  if (cached) return cached;

  const path = filePath();
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf-8"));
      cached = {
        petSize:
          parsed?.petSize === "small" || parsed?.petSize === "large" || parsed?.petSize === "medium"
            ? parsed.petSize
            : DEFAULTS.petSize,
        notifyTrackChange:
          typeof parsed?.notifyTrackChange === "boolean" ? parsed.notifyTrackChange : DEFAULTS.notifyTrackChange,
        pollingSpeed: parsed?.pollingSpeed === "normal" ? "normal" : DEFAULTS.pollingSpeed,
        hoverDelay:
          parsed?.hoverDelay === "fast" || parsed?.hoverDelay === "slow" ? parsed.hoverDelay : DEFAULTS.hoverDelay,
        spinAnimation: typeof parsed?.spinAnimation === "boolean" ? parsed.spinAnimation : DEFAULTS.spinAnimation,
        mediaKeysEnabled:
          typeof parsed?.mediaKeysEnabled === "boolean" ? parsed.mediaKeysEnabled : DEFAULTS.mediaKeysEnabled,
        notificationSound:
          typeof parsed?.notificationSound === "boolean" ? parsed.notificationSound : DEFAULTS.notificationSound,
        startHidden: typeof parsed?.startHidden === "boolean" ? parsed.startHidden : DEFAULTS.startHidden,
        opacity:
          typeof parsed?.opacity === "number" && parsed.opacity >= 20 && parsed.opacity <= 100
            ? parsed.opacity
            : DEFAULTS.opacity,
      };
      return cached;
    } catch {
      // fall through to defaults
    }
  }

  cached = { ...DEFAULTS };
  return cached;
}

function persist(): void {
  writeFileSync(filePath(), JSON.stringify(cached));
}

export function getPetSize(): PetSize {
  return load().petSize;
}
export function setPetSize(size: PetSize): void {
  load().petSize = size;
  persist();
}

export function getNotifyTrackChange(): boolean {
  return load().notifyTrackChange;
}
export function setNotifyTrackChange(value: boolean): void {
  load().notifyTrackChange = value;
  persist();
}

export function getPollingSpeed(): PollingSpeed {
  return load().pollingSpeed;
}
export function setPollingSpeed(speed: PollingSpeed): void {
  load().pollingSpeed = speed;
  persist();
}

export function getHoverDelay(): HoverDelay {
  return load().hoverDelay;
}
export function setHoverDelay(delay: HoverDelay): void {
  load().hoverDelay = delay;
  persist();
}

export function getSpinAnimation(): boolean {
  return load().spinAnimation;
}
export function setSpinAnimation(value: boolean): void {
  load().spinAnimation = value;
  persist();
}

export function getMediaKeysEnabled(): boolean {
  return load().mediaKeysEnabled;
}
export function setMediaKeysEnabled(value: boolean): void {
  load().mediaKeysEnabled = value;
  persist();
}

export function getNotificationSound(): boolean {
  return load().notificationSound;
}
export function setNotificationSound(value: boolean): void {
  load().notificationSound = value;
  persist();
}

export function getStartHidden(): boolean {
  return load().startHidden;
}
export function setStartHidden(value: boolean): void {
  load().startHidden = value;
  persist();
}

export function getOpacity(): number {
  return load().opacity;
}
export function setOpacity(percent: number): void {
  // Never let it go fully (or near-)invisible — there'd be no way to find
  // and drag it back short of quitting and editing the settings file.
  load().opacity = Math.max(20, Math.min(100, Math.round(percent)));
  persist();
}

// The OS's own login-item registry is the source of truth here rather than
// our own JSON — it can't drift from what Windows actually has registered.
export function getAutoLaunch(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}
export function setAutoLaunch(value: boolean): void {
  app.setLoginItemSettings({ openAtLogin: value });
}
