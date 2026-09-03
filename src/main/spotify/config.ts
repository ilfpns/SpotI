import { app } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

interface SpotifyConfigFile {
  clientId?: string;
}

function filePath(): string {
  // userData (not app.getAppPath()) — the app path lives inside the asar
  // archive once packaged, which is read-only and not something an end
  // user can drop a file into. userData is the one place that's writable
  // both in dev and in a real installed/portable build.
  return join(app.getPath("userData"), "spotify.config.json");
}

let cachedClientId: string | null | undefined;

/**
 * Resolves the Spotify Client ID from (in order): SPOTIFY_CLIENT_ID env var
 * (dev/advanced override), or the Client ID saved from Settings → Spotify
 * (stored in userData, set via setSpotifyClientId()). Returns null if
 * neither is configured.
 */
export function getSpotifyClientId(): string | null {
  if (cachedClientId !== undefined) return cachedClientId;

  if (process.env.SPOTIFY_CLIENT_ID) {
    cachedClientId = process.env.SPOTIFY_CLIENT_ID;
    return cachedClientId;
  }

  const path = filePath();
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf-8")) as SpotifyConfigFile;
      if (parsed.clientId) {
        cachedClientId = parsed.clientId;
        return cachedClientId;
      }
    } catch {
      // fall through to null
    }
  }

  cachedClientId = null;
  return null;
}

export function setSpotifyClientId(clientId: string): void {
  const trimmed = clientId.trim();
  if (!trimmed) return;
  cachedClientId = trimmed;
  writeFileSync(filePath(), JSON.stringify({ clientId: trimmed }));
}
