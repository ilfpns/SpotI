import { screen } from "electron";
import { getPetWindow } from "./windows/petWindow";
import { getPopupWindow, positionPopupNearPet } from "./windows/popupWindow";
import { IpcChannels } from "../shared/ipcChannels";
import { POPUP_DISMISS_DELAY_MS } from "../shared/constants";

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

let dismissTimer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let onVisibilityChange: ((visible: boolean) => void) | null = null;

function clearTimers() {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
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
  if (!petWin.isDestroyed() && pointInRect(cursor, petWin.getBounds(), HOVER_MARGIN_PX)) return true;

  const popupWin = getPopupWindow();
  if (!popupWin.isDestroyed() && popupWin.isVisible() && pointInRect(cursor, popupWin.getBounds(), HOVER_MARGIN_PX)) {
    return true;
  }
  return false;
}

let currentSide: "above" | "below" = "above";

function showPopup() {
  clearTimers();
  const win = getPopupWindow();
  if (win.isVisible()) return;
  const petBounds = getPetWindow().getBounds();
  currentSide = positionPopupNearPet(petBounds);
  win.showInactive();
  // A setBounds() applied to a not-yet-shown window can be dropped by Windows
  // once the compositor surface is actually realized on show() — reapplying
  // right after show() guarantees the position actually sticks every time.
  currentSide = positionPopupNearPet(petBounds);
  win.webContents.send(IpcChannels.popupAppear, currentSide);
  onVisibilityChange?.(true);
}

function scheduleHide() {
  if (dismissTimer || hideTimer) return;
  dismissTimer = setTimeout(() => {
    dismissTimer = null;
    const win = getPopupWindow();
    if (!win.isVisible()) return;
    win.webContents.send(IpcChannels.popupDisappear, currentSide);
    hideTimer = setTimeout(() => {
      hideTimer = null;
      if (!isCursorOverPetOrPopup()) {
        win.hide();
        onVisibilityChange?.(false);
      }
    }, FADE_OUT_MS);
  }, POPUP_DISMISS_DELAY_MS);
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
    if (isCursorOverPetOrPopup()) {
      clearTimers();
      showPopup();
    } else {
      scheduleHide();
    }
  }, CURSOR_POLL_MS);
}

export function onPopupVisibilityChange(cb: (visible: boolean) => void) {
  onVisibilityChange = cb;
}

/** Force the popup open immediately, e.g. on an explicit click on the pet. */
export function forceShowPopup() {
  clearTimers();
  showPopup();
}
