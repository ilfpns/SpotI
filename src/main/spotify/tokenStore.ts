import { app, safeStorage } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";

function tokenFilePath(): string {
  return join(app.getPath("userData"), "spotify-token.enc");
}

export function saveRefreshToken(refreshToken: string): { ok: boolean; warning?: string } {
  if (!safeStorage.isEncryptionAvailable()) {
    return {
      ok: false,
      warning:
        "Secure storage isn't available on this machine, so you'll need to log in to Spotify again next time you open the app.",
    };
  }
  const encrypted = safeStorage.encryptString(refreshToken);
  writeFileSync(tokenFilePath(), encrypted);
  return { ok: true };
}

export function loadRefreshToken(): string | null {
  const path = tokenFilePath();
  if (!existsSync(path)) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = readFileSync(path);
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}

export function clearRefreshToken(): void {
  const path = tokenFilePath();
  if (existsSync(path)) unlinkSync(path);
}
