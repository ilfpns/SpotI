// A pointer that moves less than this many screen pixels between down and
// up reads as a click, not a drag — real mouse input is never perfectly
// still, so 0px would misclassify almost every deliberate click as a drag.
const CLICK_MOVE_THRESHOLD_PX = 4;

export function setupInteraction(
  el: Element,
  onDragChange: (dragging: boolean) => void,
  onClick?: () => void,
) {
  let dragging = false;
  let didMove = false;
  let dragStartScreenX = 0;
  let dragStartScreenY = 0;
  let dragStartWinX = 0;
  let dragStartWinY = 0;

  // Tracked locally (instead of re-fetching via IPC on every drag start) so
  // pointerdown can stay fully synchronous — an `await` there would leave a
  // brief window where dragging/didMove aren't set yet, and a pointerup
  // landing inside that window would silently be dropped (neither the
  // click nor the drag path would run). Populated ASAP via a non-blocking
  // fetch and kept in sync with the real window position on every drag
  // move below.
  let winX = 0;
  let winY = 0;
  window.petAPI.getPosition().then((pos) => {
    winX = pos.x;
    winY = pos.y;
  });

  // The pet's window is small and never click-through (see petWindow.ts),
  // so it always captures everything in its own bounds — no hover-based
  // "wake up the window" step needed before pointer events start working.
  function isOverPet(clientX: number, clientY: number): boolean {
    const rect = el.getBoundingClientRect();
    return clientX >= rect.left && clientX < rect.right && clientY >= rect.top && clientY < rect.bottom;
  }

  el.addEventListener("pointerdown", (e: Event) => {
    const pe = e as PointerEvent;
    if (pe.button !== 0) return; // only the left button starts a drag
    if (!isOverPet(pe.clientX, pe.clientY)) return;
    window.petAPI.forceShowPopup();
    dragging = true;
    didMove = false;
    dragStartScreenX = pe.screenX;
    dragStartScreenY = pe.screenY;
    dragStartWinX = winX;
    dragStartWinY = winY;
    el.setPointerCapture(pe.pointerId);
  });

  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.screenX - dragStartScreenX;
    const dy = e.screenY - dragStartScreenY;
    // Only declared an actual drag (and only then does onDragChange(true)
    // fire) once real movement happens — mirrors the onDragChange(false)/
    // onClick() split on release, so "dragging" toggles true/false in pairs
    // instead of firing true for a plain click that never followed up.
    if (!didMove && Math.hypot(dx, dy) > CLICK_MOVE_THRESHOLD_PX) {
      didMove = true;
      onDragChange(true);
    }
    winX = dragStartWinX + dx;
    winY = dragStartWinY + dy;
    window.petAPI.moveTo(winX, winY);
  });

  window.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (didMove) {
      window.petAPI.savePosition();
      onDragChange(false);
    } else {
      onClick?.();
    }
  });

  el.addEventListener("contextmenu", (e: Event) => {
    const me = e as MouseEvent;
    if (!isOverPet(me.clientX, me.clientY)) return;
    e.preventDefault();
    window.petAPI.showContextMenu();
  });
}
