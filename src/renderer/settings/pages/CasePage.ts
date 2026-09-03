import { DISC_NAME_MAX_LENGTH, sanitizeDiscName, type CaseShape } from "../../../shared/theme";
import { initColorPicker, createSegmented } from "../uiControls";

export async function initCasePage() {
  initColorPicker(
    "case-color-presets",
    "case-color-wheel-input",
    () => window.petAPI.getCaseColor(),
    (c) => window.petAPI.setCaseColor(c),
    (cb) => window.petAPI.onCaseColorChanged(cb),
  );

  const shapeRoot = document.getElementById("case-shape-segmented") as HTMLElement;
  const currentShape = await window.petAPI.getCaseShape();
  createSegmented<CaseShape>(
    shapeRoot,
    [
      { value: "classic", labelKey: "caseShape.classic" },
      { value: "cut", labelKey: "caseShape.cut" },
    ],
    currentShape,
    (next) => window.petAPI.setCaseShape(next),
  );

  const nameInput = document.getElementById("disc-name-input") as HTMLInputElement;
  nameInput.maxLength = DISC_NAME_MAX_LENGTH;
  nameInput.value = await window.petAPI.getDiscName();

  nameInput.addEventListener("input", () => {
    const sanitized = sanitizeDiscName(nameInput.value);
    const cursor = nameInput.selectionStart;
    if (sanitized !== nameInput.value) {
      nameInput.value = sanitized;
      if (cursor !== null) nameInput.setSelectionRange(cursor - 1, cursor - 1);
    }
    window.petAPI.setDiscName(sanitized);
  });

  window.petAPI.onDiscNameChanged((name) => {
    if (document.activeElement !== nameInput) nameInput.value = name;
  });
}
