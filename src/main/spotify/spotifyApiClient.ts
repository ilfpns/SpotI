import { ensureAccessToken } from "./authService";
import type { NowPlayingState, SpotifyErrorCode, SpotifyResult } from "../../shared/types";

const API_BASE = "https://api.spotify.com/v1";

// Fast polling can realistically hit Spotify's rate limit — rather than keep
// hammering it, back off for whatever it tells us (or a short default) and
// fail fast locally until then, instead of making it worse.
let rateLimitedUntil = 0;

async function spotifyFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; json: unknown }> {
  if (Date.now() < rateLimitedUntil) {
    throw { code: "rate_limited" as SpotifyErrorCode };
  }

  const token = await ensureAccessToken();
  if (!token) {
    throw { code: "not_authenticated" as SpotifyErrorCode };
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (res.status === 429) {
    const retryAfterSec = Number(res.headers.get("retry-after")) || 2;
    rateLimitedUntil = Date.now() + retryAfterSec * 1000;
    throw { code: "rate_limited" as SpotifyErrorCode };
  }

  if (res.status === 204) return { status: 204, json: null };

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: res.status, json };
}

function mapErrorStatus(status: number): SpotifyErrorCode {
  if (status === 401) return "not_authenticated";
  if (status === 403) return "premium_required";
  if (status === 404) return "no_active_device";
  return "unknown_error";
}

async function callWithErrorMapping<T>(
  fn: () => Promise<T>,
): Promise<SpotifyResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    if (e && typeof e === "object" && "code" in e) {
      return { ok: false, error: (e as { code: SpotifyErrorCode }).code };
    }
    if (e instanceof TypeError) {
      return { ok: false, error: "network_error", message: e.message };
    }
    return { ok: false, error: "unknown_error", message: e instanceof Error ? e.message : String(e) };
  }
}

export function getNowPlaying(): Promise<SpotifyResult<NowPlayingState | null>> {
  return callWithErrorMapping(async () => {
    const { status, json } = await spotifyFetch("/me/player");
    if (status === 204 || !json) return null;

    const body = json as {
      is_playing: boolean;
      progress_ms: number | null;
      shuffle_state: boolean;
      repeat_state: "off" | "context" | "track";
      item: {
        id: string;
        name: string;
        artists: { name: string }[];
        album: { images: { url: string }[] };
        duration_ms: number;
      } | null;
    };

    if (!body.item) return null;

    return {
      isPlaying: body.is_playing,
      trackId: body.item.id,
      title: body.item.name,
      artist: body.item.artists.map((a) => a.name).join(", "),
      albumArtUrl: body.item.album.images[0]?.url ?? null,
      progressMs: body.progress_ms,
      durationMs: body.item.duration_ms,
      shuffleState: body.shuffle_state,
      repeatState: body.repeat_state,
    };
  });
}

function assertOkOrThrow(status: number) {
  if (status !== 200 && status !== 204) {
    throw { code: mapErrorStatus(status) as SpotifyErrorCode };
  }
}

export function play(): Promise<SpotifyResult<void>> {
  return callWithErrorMapping(async () => {
    const { status } = await spotifyFetch("/me/player/play", { method: "PUT" });
    assertOkOrThrow(status);
  });
}

export function pause(): Promise<SpotifyResult<void>> {
  return callWithErrorMapping(async () => {
    const { status } = await spotifyFetch("/me/player/pause", { method: "PUT" });
    assertOkOrThrow(status);
  });
}

export function next(): Promise<SpotifyResult<void>> {
  return callWithErrorMapping(async () => {
    const { status } = await spotifyFetch("/me/player/next", { method: "POST" });
    assertOkOrThrow(status);
  });
}

export function previous(): Promise<SpotifyResult<void>> {
  return callWithErrorMapping(async () => {
    const { status } = await spotifyFetch("/me/player/previous", { method: "POST" });
    assertOkOrThrow(status);
  });
}

export function seek(positionMs: number): Promise<SpotifyResult<void>> {
  return callWithErrorMapping(async () => {
    const { status } = await spotifyFetch(`/me/player/seek?position_ms=${Math.round(positionMs)}`, {
      method: "PUT",
    });
    assertOkOrThrow(status);
  });
}

export function setVolume(percent: number): Promise<SpotifyResult<void>> {
  return callWithErrorMapping(async () => {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    const { status } = await spotifyFetch(`/me/player/volume?volume_percent=${clamped}`, {
      method: "PUT",
    });
    assertOkOrThrow(status);
  });
}

export function setShuffle(enabled: boolean): Promise<SpotifyResult<void>> {
  return callWithErrorMapping(async () => {
    const { status } = await spotifyFetch(`/me/player/shuffle?state=${enabled}`, { method: "PUT" });
    assertOkOrThrow(status);
  });
}

export function setRepeat(mode: "off" | "context" | "track"): Promise<SpotifyResult<void>> {
  return callWithErrorMapping(async () => {
    const { status } = await spotifyFetch(`/me/player/repeat?state=${mode}`, { method: "PUT" });
    assertOkOrThrow(status);
  });
}

export function getVolume(): Promise<SpotifyResult<number | null>> {
  return callWithErrorMapping(async () => {
    const { status, json } = await spotifyFetch("/me/player");
    if (status === 204 || !json) return null;
    const body = json as { device?: { volume_percent: number | null } };
    return body.device?.volume_percent ?? null;
  });
}
