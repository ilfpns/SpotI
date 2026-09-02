import { app } from "electron";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

interface SpotifyConfigFile {
  clientId?: string;
}

let cachedClientId: string | null | undefined;

/**
 * Resolves the Spotify Client ID from (in order): SPOTIFY_CLIENT_ID env var,
 * or a gitignored spotify.config.json at the project root (see
 * spotify.config.json.example). Returns null if neither is configured.
 */
export function getSpotifyClientId(): string | null {
  if (cachedClientId !== undefined) return cachedClientId;

  if (process.env.SPOTIFY_CLIENT_ID) {
    cachedClientId = process.env.SPOTIFY_CLIENT_ID;
    return cachedClientId;
  }

  const configPath = join(app.getAppPath(), "spotify.config.json");
  if (existsSync(configPath)) {
    try {
      const parsed = JSON.parse(readFileSync(configPath, "utf-8")) as SpotifyConfigFile;
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
