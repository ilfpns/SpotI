import { shell } from "electron";
import { generatePkcePair, generateState } from "./pkce";
import { waitForOAuthCallback } from "./loopbackServer";
import { getSpotifyClientId } from "./config";
import { saveRefreshToken, loadRefreshToken, clearRefreshToken } from "./tokenStore";
import { SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES } from "../../shared/constants";
import type { AuthStatus } from "../../shared/types";

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";
const REFRESH_BUFFER_MS = 60_000;

interface Session {
  accessToken: string;
  expiresAt: number; // epoch ms
  refreshToken: string;
}

let session: Session | null = null;
let refreshInFlight: Promise<string | null> | null = null;

function setSession(accessToken: string, expiresInSec: number, refreshToken: string) {
  session = {
    accessToken,
    expiresAt: Date.now() + expiresInSec * 1000,
    refreshToken,
  };
}

export function getAuthStatus(): AuthStatus {
  return { authenticated: session !== null, displayName: null };
}

export async function tryRestoreSession(): Promise<boolean> {
  const refreshToken = loadRefreshToken();
  if (!refreshToken) return false;
  const accessToken = await refreshWithToken(refreshToken);
  return accessToken !== null;
}

export async function login(): Promise<{ ok: boolean; message?: string }> {
  const clientId = getSpotifyClientId();
  if (!clientId) {
    return {
      ok: false,
      message:
        "No Spotify Client ID configured. Copy spotify.config.json.example to " +
        "spotify.config.json and fill in your Client ID from developer.spotify.com/dashboard.",
    };
  }

  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = generateState();

  const authorizeUrl = new URL(AUTHORIZE_ENDPOINT);
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    scope: SPOTIFY_SCOPES,
    state,
  }).toString();

  const callbackPromise = waitForOAuthCallback(state);
  await shell.openExternal(authorizeUrl.toString());

  let code: string;
  try {
    code = await callbackPromise;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Login failed" };
  }

  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        client_id: clientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!res.ok) {
      return { ok: false, message: `Token exchange failed (${res.status})` };
    }

    const json = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    setSession(json.access_token, json.expires_in, json.refresh_token);
    const saveResult = saveRefreshToken(json.refresh_token);
    return { ok: true, message: saveResult.ok ? undefined : saveResult.warning };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Token exchange failed" };
  }
}

export function logout(): void {
  session = null;
  clearRefreshToken();
}

async function refreshWithToken(refreshToken: string): Promise<string | null> {
  const clientId = getSpotifyClientId();
  if (!clientId) return null;

  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    });

    if (!res.ok) return null;

    const json = (await res.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    const newRefreshToken = json.refresh_token ?? refreshToken;
    setSession(json.access_token, json.expires_in, newRefreshToken);
    if (json.refresh_token) saveRefreshToken(json.refresh_token);
    return json.access_token;
  } catch {
    return null;
  }
}

/** Returns a valid access token, refreshing first if it's near expiry. Null if not authenticated. */
export async function ensureAccessToken(): Promise<string | null> {
  if (!session) return null;

  if (Date.now() < session.expiresAt - REFRESH_BUFFER_MS) {
    return session.accessToken;
  }

  if (!refreshInFlight) {
    const currentRefreshToken = session.refreshToken;
    refreshInFlight = refreshWithToken(currentRefreshToken).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}
