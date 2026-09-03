import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IpcChannels } from "../../shared/ipcChannels";
import type { NowPlayingState } from "../../shared/types";

const { fakeWindow, state } = vi.hoisted(() => {
  const state = {
    getNowPlayingQueue: [] as Array<() => Promise<{ ok: true; data: NowPlayingState | null }>>,
    sendCalls: [] as NowPlayingState[],
  };
  const fakeWindow = {
    webContents: {
      send: (channel: string, payload: NowPlayingState) => {
        if (channel === IpcChannels.nowPlayingChanged) state.sendCalls.push(payload);
      },
    },
  };
  return { fakeWindow, state };
});

vi.mock("electron", () => ({
  BrowserWindow: { getAllWindows: () => [fakeWindow] },
  Notification: { isSupported: () => false },
  nativeImage: { createFromBuffer: () => ({}) },
}));
vi.mock("./spotifyApiClient", () => ({
  // tick() always reschedules itself at the end, so an unmocked extra tick
  // firing (e.g. from advancing fake timers further than a test explicitly
  // queued responses for) must resolve gracefully rather than throw.
  getNowPlaying: () => (state.getNowPlayingQueue.shift() ?? (async () => ({ ok: true, data: null })))(),
}));
vi.mock("../appSettingsStore", () => ({
  getNotifyTrackChange: () => false,
  getPollingSpeed: () => "fast" as const,
  getNotificationSound: () => false,
}));
vi.mock("../localeStore", () => ({ getLocale: () => "en" as const }));
vi.mock("../../shared/i18n", () => ({ translate: () => "" }));
vi.mock("../listeningHistoryStore", () => ({ recordListening: () => {}, recordTrackStart: (..._args: unknown[]) => {} }));

function track(isPlaying: boolean): NowPlayingState {
  return {
    isPlaying,
    trackId: "t1",
    title: "Crying",
    artist: "BOYNEXTDOOR",
    albumArtUrl: null,
    albumId: "a1",
    albumName: "Album",
    progressMs: 1000,
    durationMs: 200_000,
    shuffleState: false,
    repeatState: "off",
    volumePercent: 80,
  };
}

/** Queues a getNowPlaying() response that only resolves once `resolveWith` is called — lets a test control exactly when an in-flight poll lands relative to other events. */
function deferredPoll(data: NowPlayingState | null): { resolveWith: () => void } {
  let resolve!: () => void;
  const gate = new Promise<void>((r) => (resolve = r));
  state.getNowPlayingQueue.push(async () => {
    await gate;
    return { ok: true, data };
  });
  return { resolveWith: resolve };
}

function immediatePoll(data: NowPlayingState | null) {
  state.getNowPlayingQueue.push(async () => ({ ok: true, data }));
}

describe("pollingService optimistic play/pause sync", () => {
  let mod: typeof import("./pollingService");

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    state.getNowPlayingQueue = [];
    state.sendCalls = [];
    mod = await import("./pollingService");
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("a stale in-flight tick queried before an action does not overwrite the optimistic broadcast", async () => {
    // Seed lastState via an initial poll (isPlaying: false).
    immediatePoll(track(false));
    await mod.pollNow();
    expect(state.sendCalls.at(-1)?.isPlaying).toBe(false);

    // A regular tick starts (queried Spotify before the action below took
    // effect there) and will resolve with the pre-action, now-stale value.
    const staleTick = deferredPoll(track(false));
    const tickPromise = mod.pollNow();

    // The action completes and broadcasts the confirmed new state — this
    // must win even though the stale tick above resolves after it.
    mod.broadcastOptimisticPlayState(true);
    expect(state.sendCalls.at(-1)?.isPlaying).toBe(true);

    staleTick.resolveWith();
    await tickPromise;

    // The stale tick's contradicting response must have been discarded, not broadcast.
    expect(state.sendCalls.at(-1)?.isPlaying).toBe(true);
  });

  it("pollNow() right after an action does not flicker back to Spotify's not-yet-propagated state (the exact bug this fixes)", async () => {
    immediatePoll(track(false));
    await mod.pollNow();

    // Action succeeds; UI is told isPlaying is now true.
    mod.broadcastOptimisticPlayState(true);
    expect(state.sendCalls.at(-1)?.isPlaying).toBe(true);

    // pollNow() fires immediately after, but Spotify's own GET still briefly
    // echoes the pre-action state (server-side propagation lag).
    immediatePoll(track(false));
    await mod.pollNow();

    // Must not have flickered back to false at any point after the optimistic broadcast.
    const afterOptimistic = state.sendCalls.slice(1);
    expect(afterOptimistic.every((s) => s.isPlaying === true)).toBe(true);
  });

  it("a genuine track change landing during the guard window still comes through, with the guarded isPlaying value rather than the poll's stale one", async () => {
    immediatePoll(track(false));
    await mod.pollNow();

    mod.broadcastOptimisticPlayState(true);

    // Spotify auto-advanced to a new track, but this poll's isPlaying still
    // echoes the pre-action value (propagation lag) — the track change itself
    // must still come through, merged with the guarded isPlaying.
    const newTrack = { ...track(false), trackId: "t2", title: "New Song" };
    immediatePoll(newTrack);
    await mod.pollNow();

    const last = state.sendCalls.at(-1)!;
    expect(last.trackId).toBe("t2");
    expect(last.isPlaying).toBe(true);
  });

  it("a genuine external change after the guard window expires is still reflected", async () => {
    immediatePoll(track(false));
    await mod.pollNow();
    mod.broadcastOptimisticPlayState(true);

    vi.advanceTimersByTime(2_000); // past OPTIMISTIC_GUARD_MS

    immediatePoll(track(false));
    await mod.pollNow();

    expect(state.sendCalls.at(-1)?.isPlaying).toBe(false);
  });
});

describe("pollingService cache freshness (getLastKnownState)", () => {
  let mod: typeof import("./pollingService");

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    state.getNowPlayingQueue = [];
    state.sendCalls = [];
    mod = await import("./pollingService");
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("getLastKnownState().volumePercent stays fresh across polls even when track/isPlaying don't change (the getVolume IPC handler reads this cache)", async () => {
    immediatePoll(track(true));
    await mod.pollNow();
    expect(mod.getLastKnownState()?.volumePercent).toBe(80);

    immediatePoll({ ...track(true), volumePercent: 33 });
    await mod.pollNow();
    // trackId/isPlaying are unchanged from the first poll, so this doesn't
    // broadcast — but the cache itself must still pick up the new volume.
    expect(mod.getLastKnownState()?.volumePercent).toBe(33);
  });

  it("a shuffle-only change still broadcasts, so the popup's optimistic shuffle toggle reconciles with what Spotify actually did", async () => {
    immediatePoll(track(true));
    await mod.pollNow();
    expect(state.sendCalls).toHaveLength(1);

    // Same track, same isPlaying — only shuffleState differs (e.g. Spotify
    // rejected/overrode a setShuffle(true) call from the popup).
    immediatePoll({ ...track(true), shuffleState: true });
    await mod.pollNow();

    expect(state.sendCalls).toHaveLength(2);
    expect(state.sendCalls.at(-1)?.shuffleState).toBe(true);
  });

  it("a repeat-only change still broadcasts, for the same reconciliation reason", async () => {
    immediatePoll(track(true));
    await mod.pollNow();

    immediatePoll({ ...track(true), repeatState: "track" });
    await mod.pollNow();

    expect(state.sendCalls).toHaveLength(2);
    expect(state.sendCalls.at(-1)?.repeatState).toBe("track");
  });
});
