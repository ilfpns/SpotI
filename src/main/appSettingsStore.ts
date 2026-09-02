import { app } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  DEFAULT_PET_SIZE,
  DEFAULT_POLLING_SPEED,
  type PetSize,
  type PollingSpeed,
} from "../shared/constants";

interface StoredSettings {
  petSize: PetSize;
  notifyTrackChange: boolean;
  pollingSpeed: PollingSpeed;
}

const DEFAULTS: StoredSettings = {
  petSize: DEFAULT_PET_SIZE,
  notifyTrackChange: true,
  pollingSpeed: DEFAULT_POLLING_SPEED,
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

// The OS's own login-item registry is the source of truth here rather than
// our own JSON — it can't drift from what Windows actually has registered.
export function getAutoLaunch(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}
export function setAutoLaunch(value: boolean): void {
  app.setLoginItemSettings({ openAtLogin: value });
}
