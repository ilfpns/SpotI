import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IpcChannels } from "../shared/ipcChannels";

const PET_BOUNDS = { x: 1000, y: 1000, width: 64, height: 64 };
const CURSOR_POLL_MS = 60; // must match popupController.ts's internal constant

const { fakePetWindow, fakePopupWindow, state } = vi.hoisted(() => {
  const state = {
    cursorPos: { x: -100_000, y: -100_000 },
    popupVisible: false,
    sendCalls: [] as string[],
  };
  const fakePetWindow = {
    isDestroyed: () => false,
    isVisible: () => true,
    getBounds: () => ({ x: 1000, y: 1000, width: 64, height: 64 }),
  };
  const fakePopupWindow = {
    isDestroyed: () => false,
    isVisible: () => state.popupVisible,
    getBounds: () => ({ x: 900, y: 900, width: 360, height: 190 }),
    showInactive: () => {
      state.popupVisible = true;
    },
    hide: () => {
      state.popupVisible = false;
    },
    webContents: {
      send: (channel: string) => {
        state.sendCalls.push(channel);
      },
    },
  };
  return { fakePetWindow, fakePopupWindow, state };
});

vi.mock("electron", () => ({
  screen: { getCursorScreenPoint: () => ({ ...state.cursorPos }) },
}));
vi.mock("./windows/petWindow", () => ({ getPetWindow: () => fakePetWindow }));
vi.mock("./windows/popupWindow", () => ({
  getPopupWindow: () => fakePopupWindow,
  positionPopupNearPet: () => "above" as const,
}));
vi.mock("./appSettingsStore", () => ({ getHoverDelay: () => "normal" as const }));

function setCursorOver() {
  state.cursorPos = { x: PET_BOUNDS.x + 10, y: PET_BOUNDS.y + 10 };
}
function setCursorAway() {
  state.cursorPos = { x: -100_000, y: -100_000 };
}
function tick(ms: number) {
  vi.advanceTimersByTime(ms);
}

/** The property the original bug violated: cursor over the pet must eventually mean a truly-visible, freshly-(re)announced popup — never a window left OS-visible but stuck showing its exit animation. */
function expectTrulyVisible() {
  expect(fakePopupWindow.isVisible()).toBe(true);
  expect(state.sendCalls[state.sendCalls.length - 1]).toBe(IpcChannels.popupAppear);
}

describe("popupController hover reliability", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    state.popupVisible = false;
    state.sendCalls = [];
    setCursorAway();
    vi.resetModules();
    const mod = await import("./popupController");
    mod.startPopupCursorWatcher();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("shows on a normal hover", () => {
    setCursorOver();
    tick(CURSOR_POLL_MS);
    expectTrulyVisible();
  });

  it("recovers when the cursor returns during the grace window", () => {
    setCursorOver();
    tick(CURSOR_POLL_MS);
    expectTrulyVisible();

    setCursorAway();
    tick(CURSOR_POLL_MS); // enters "grace"
    tick(30); // still inside the ~60ms grace delay, before it would start closing

    setCursorOver();
    tick(CURSOR_POLL_MS);
    expectTrulyVisible();
  });

  it("recovers when the cursor returns mid-fade-out (the exact bug this fixes)", () => {
    setCursorOver();
    tick(CURSOR_POLL_MS);
    expectTrulyVisible();

    setCursorAway();
    tick(CURSOR_POLL_MS); // enters "grace"
    tick(70); // grace elapses -> "closing": popupDisappear sent, window still OS-visible
    expect(fakePopupWindow.isVisible()).toBe(true);
    expect(state.sendCalls[state.sendCalls.length - 1]).toBe(IpcChannels.popupDisappear);

    setCursorOver();
    tick(CURSOR_POLL_MS); // next poll tick — must resend popupAppear, not silently no-op
    expectTrulyVisible();
  });

  it("survives rapid on/off toggling faster than the poll interval", () => {
    for (let i = 0; i < 300; i++) {
      if (i % 2 === 0) setCursorOver();
      else setCursorAway();
      tick(20); // faster than CURSOR_POLL_MS (60ms)
    }
    setCursorOver();
    tick(1000); // let everything settle
    expectTrulyVisible();
  });

  it("survives slow toggling with multi-second gaps", () => {
    for (let i = 0; i < 20; i++) {
      if (i % 2 === 0) setCursorOver();
      else setCursorAway();
      tick(3000);
    }
    setCursorOver();
    tick(1000);
    expectTrulyVisible();
  });

  it("survives randomized toggling across a wide range of intervals", () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 1000; i++) {
      if (rand() < 0.5) setCursorOver();
      else setCursorAway();
      tick(Math.floor(rand() * 3000) + 1); // 1ms .. 3s
    }
    setCursorOver();
    tick(1000);
    expectTrulyVisible();
  });
});
