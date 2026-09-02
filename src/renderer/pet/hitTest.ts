export function setupInteraction(el: Element, onDragChange: (dragging: boolean) => void) {
  let isInteractive = false;
  let dragging = false;
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
    dragStartScreenX = pe.screenX;
    dragStartScreenY = pe.screenY;
    dragStartWinX = start.x;
    dragStartWinY = start.y;
    el.setPointerCapture(pe.pointerId);
    onDragChange(true);
  });

  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.screenX - dragStartScreenX;
    const dy = e.screenY - dragStartScreenY;
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
    onDragChange(false);
  });

  el.addEventListener("contextmenu", (e: Event) => {
    const me = e as MouseEvent;
    if (!isOverPet(me.clientX, me.clientY)) return;
    e.preventDefault();
    window.petAPI.showContextMenu();
  });
}
