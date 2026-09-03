import { RAINBOW_PRESETS, type UiTheme } from "../../../shared/theme";
import { createSegmented, createToggle } from "../uiControls";

/** A row of preset swatches + a custom color-wheel trigger, generic over which color it's editing. */
function initColorPicker(
  presetsId: string,
  wheelId: string,
  getColor: () => Promise<string>,
  setColor: (color: string) => void,
  onExternalChange: (cb: (color: string) => void) => void,
) {
  const presetsEl = document.getElementById(presetsId) as HTMLElement;
  const wheelInput = document.getElementById(wheelId) as HTMLInputElement;

  getColor().then((initial) => {
    let currentColor = initial;

    function render() {
      presetsEl.innerHTML = RAINBOW_PRESETS.map(
        (color) => `
          <button
            class="swatch ${color.toLowerCase() === currentColor.toLowerCase() ? "selected" : ""}"
            data-color="${color}"
            style="background:${color}"
          ></button>
        `,
      ).join("");
      wheelInput.value = currentColor;
    }

    function choose(color: string) {
      currentColor = color;
      setColor(color);
      render();
    }

    presetsEl.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-color]");
      if (!target) return;
      choose(target.dataset.color!);
    });

    wheelInput.addEventListener("input", () => choose(wheelInput.value));

    render();
    onExternalChange((color) => {
      currentColor = color;
      render();
    });
  });
}

export async function initThemePage() {
  initColorPicker(
    "font-color-presets",
    "font-color-wheel-input",
    () => window.petAPI.getFontColor(),
    (c) => window.petAPI.setFontColor(c),
    (cb) => window.petAPI.onFontColorChanged(cb),
  );

  initColorPicker(
    "label-color-presets",
    "label-color-wheel-input",
    () => window.petAPI.getLabelColor(),
    (c) => window.petAPI.setLabelColor(c),
    (cb) => window.petAPI.onLabelColorChanged(cb),
  );

  initColorPicker(
    "case-color-presets",
    "case-color-wheel-input",
    () => window.petAPI.getCaseColor(),
    (c) => window.petAPI.setCaseColor(c),
    (cb) => window.petAPI.onCaseColorChanged(cb),
  );

  const uiThemeRoot = document.getElementById("ui-theme-segmented") as HTMLElement;
  const current = await window.petAPI.getUiTheme();
  createSegmented<UiTheme>(
    uiThemeRoot,
    [
      { value: "dark", labelKey: "uiTheme.dark" },
      { value: "light", labelKey: "uiTheme.light" },
    ],
    current,
    (next) => window.petAPI.setUiTheme(next),
  );

  const borderRoot = document.getElementById("border-toggle") as HTMLElement;
  window.petAPI.getShowBorder().then((value) => {
    createToggle(borderRoot, value, (next) => window.petAPI.setShowBorder(next));
  });

  initColorPicker(
    "border-color-presets",
    "border-color-wheel-input",
    () => window.petAPI.getBorderColor(),
    (c) => window.petAPI.setBorderColor(c),
    (cb) => window.petAPI.onBorderColorChanged(cb),
  );
}
