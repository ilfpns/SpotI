// A pointer that moves less than this many screen pixels between down and
// up reads as a click, not a drag — real mouse input is never perfectly
// still, so 0px would misclassify almost every deliberate click as a drag.
const CLICK_MOVE_THRESHOLD_PX = 4;

export function setupInteraction(
  el: Element,
  onDragChange: (dragging: boolean) => void,
  onClick?: () => void,
) {
  let isInteractive = false;
  let dragging = false;
  let didMove = false;
  let dragStartScreenX = 0;
  let dragStartScreenY = 0;
  let dragStartWinX = 0;
  let dragStartWinY = 0;

  // The pet's sleeve+disc artwork fills almost the entire element, so a
  // simple bounding-box check is close enough — no pixel sampling needed.
  function isOverPet(clientX: number, clientY: number): boolean {
    const rect = el.getBoundingClientRect();
    return clientX >= rect.left && clientX < rect.right && clientY >= rect.top && clientY < rect.bottom;
  }

  function setInteractive(next: boolean) {
    if (next === isInteractive) return;
    isInteractive = next;
    window.petAPI.setIgnoreMouseEvents(!next);
  }

  // While the window is click-through (setIgnoreMouseEvents + forward:true),
  // Electron only forwards plain "mousemove" — not Pointer Events — so the
  // ambient hover check has to use mousemove, not pointermove.
  window.addEventListener("mousemove", (e) => {
    if (dragging) return;
    setInteractive(isOverPet(e.clientX, e.clientY));
  });

  window.addEventListener("mouseout", () => {
    if (!dragging) setInteractive(false);
  });

  // Once hover made the window interactive (ignore=false), it's a normal
  // window again, so Pointer Events + capture work for reliable dragging
  // (keeps receiving move/up even if the cursor outruns this tiny window).
  el.addEventListener("pointerdown", async (e: Event) => {
    const pe = e as PointerEvent;
    if (pe.button !== 0) return; // only the left button starts a drag
    if (!isOverPet(pe.clientX, pe.clientY)) return;
    window.petAPI.forceShowPopup();
    const start = await window.petAPI.getPosition();
    dragging = true;
    didMove = false;
    dragStartScreenX = pe.screenX;
    dragStartScreenY = pe.screenY;
    dragStartWinX = start.x;
    dragStartWinY = start.y;
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
    window.petAPI.moveTo(dragStartWinX + dx, dragStartWinY + dy);
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
