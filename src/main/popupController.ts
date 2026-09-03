import { screen } from "electron";
import { getPetWindow } from "./windows/petWindow";
import { getPopupWindow, positionPopupNearPet } from "./windows/popupWindow";
import { IpcChannels } from "../shared/ipcChannels";
import { POPUP_DISMISS_DELAY_MS } from "../shared/constants";
import { getHoverDelay } from "./appSettingsStore";

// Must be >= the popup's CSS ".fast-exit" transform/opacity transition
// duration (see renderer/popup/popup.css), or the window gets hidden while
// the shrink-back-into-the-case animation is still mid-flight and visibly
// cuts it off.
const FADE_OUT_MS = 170;
// 60Hz (16ms) is imperceptibly different from ~15Hz for a hover trigger but
// wakes the process 4x as often for no benefit — keep this modest for RAM/CPU.
const CURSOR_POLL_MS = 60;
// Extra slack around the pet/popup rects so the dismiss check doesn't fire
// from a 1px rounding gap while the cursor is genuinely still over an edge,
// and so a brief hover isn't missed between two poll samples.
const HOVER_MARGIN_PX = 6;

// Explicit state machine — the single source of truth for what the popup is
// doing, instead of inferring it from win.isVisible() + "is a timer
// currently pending". That mixed approach had a real bug: while "closing"
// the window stays OS-visible until the fade-out timer finishes, so a
// naive "if already visible, do nothing" check on re-entry would skip
// resending popupAppear — the window would still be technically visible,
// but its renderer-side CSS would be stuck mid-exit-animation, so it never
// visually came back. Rapid or even just mistimed hover in/out could land
// exactly in that window and get the popup stuck invisible-looking until
// the close sequence finally finished on its own.
type PopupPhase = "hidden" | "visible" | "grace" | "closing";
let phase: PopupPhase = "hidden";

let graceTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let onVisibilityChange: ((visible: boolean) => void) | null = null;
let currentSide: "above" | "below" = "above";

function clearTimers() {
  if (graceTimer) {
    clearTimeout(graceTimer);
    graceTimer = null;
  }
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

function pointInRect(
  point: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
  margin: number,
): boolean {
  return (
    point.x >= rect.x - margin &&
    point.x <= rect.x + rect.width + margin &&
    point.y >= rect.y - margin &&
    point.y <= rect.y + rect.height + margin
  );
}

function isCursorOverPetOrPopup(): boolean {
  const cursor = screen.getCursorScreenPoint();
  const petWin = getPetWindow();
  if (!petWin.isDestroyed() && petWin.isVisible() && pointInRect(cursor, petWin.getBounds(), HOVER_MARGIN_PX)) {
    return true;
  }

  const popupWin = getPopupWindow();
  if (!popupWin.isDestroyed() && popupWin.isVisible() && pointInRect(cursor, popupWin.getBounds(), HOVER_MARGIN_PX)) {
    return true;
  }
  return false;
}

/** Enter (or re-enter) the visible state — always resends popupAppear, regardless of the window's prior phase. */
function doShow() {
  clearTimers();
  const win = getPopupWindow();
  const petBounds = getPetWindow().getBounds();
  currentSide = positionPopupNearPet(petBounds);
  if (!win.isVisible()) {
    win.showInactive();
    // A setBounds() applied to a not-yet-shown window can be dropped by
    // Windows once the compositor surface is actually realized on show() —
    // reapplying right after show() guarantees the position actually
    // sticks every time.
    currentSide = positionPopupNearPet(petBounds);
  }
  win.webContents.send(IpcChannels.popupAppear, currentSide);
  onVisibilityChange?.(true);
  phase = "visible";
}

/** Cursor just left — wait a short grace period (so a quick pass over the pet/popup gap doesn't flicker) before starting to close. */
function beginGrace() {
  phase = "grace";
  graceTimer = setTimeout(() => {
    graceTimer = null;
    beginClosing();
  }, POPUP_DISMISS_DELAY_MS[getHoverDelay()]);
}

/** Grace period elapsed and the cursor is still away — play the exit animation, then actually hide the window. */
function beginClosing() {
  phase = "closing";
  const win = getPopupWindow();
  win.webContents.send(IpcChannels.popupDisappear, currentSide);
  closeTimer = setTimeout(() => {
    closeTimer = null;
    win.hide();
    onVisibilityChange?.(false);
    phase = "hidden";
  }, FADE_OUT_MS);
}

/**
 * A single always-on poll owns the show/hide decision end to end, using the
 * live cursor position against the pet/popup windows' real OS bounds. This
 * avoids the class of race conditions that come from mixing renderer-reported
 * hover events (delayed by an IPC round trip) with an independently-timed
 * dismiss check — a stale "hover" report could otherwise arrive after the
 * cursor had already left, undoing a dismiss that was already in flight.
 */
export function startPopupCursorWatcher() {
  setInterval(() => {
    const wanted = isCursorOverPetOrPopup();
    if (wanted) {
      if (phase !== "visible") doShow();
    } else if (phase === "visible") {
      beginGrace();
    }
    // phase === "grace" or "closing": a close sequence is already in
    // flight and the cursor is still away — nothing to do, let it finish.
  }, CURSOR_POLL_MS);
}

export function onPopupVisibilityChange(cb: (visible: boolean) => void) {
  onVisibilityChange = cb;
}

/** Force the popup open immediately, e.g. on an explicit click on the pet. */
export function forceShowPopup() {
  doShow();
}
