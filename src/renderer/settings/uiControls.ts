import { t, onLocaleChange } from "../i18nClient";
import { RAINBOW_PRESETS } from "../../shared/theme";

/** Builds a `.toggle` switch inside `root`. */
export function createToggle(root: HTMLElement, initial: boolean, onChange: (value: boolean) => void) {
  root.innerHTML = `<button class="toggle" type="button" role="switch"><span class="toggle-thumb"></span></button>`;
  const btn = root.querySelector(".toggle") as HTMLButtonElement;
  btn.setAttribute("aria-checked", String(initial));
  btn.addEventListener("click", () => {
    const next = btn.getAttribute("aria-checked") !== "true";
    btn.setAttribute("aria-checked", String(next));
    onChange(next);
  });
}

/** Builds a pill-style segmented control inside `root`, re-rendered on locale change so its labels stay translated. */
export function createSegmented<T extends string>(
  root: HTMLElement,
  options: { value: T; labelKey: string }[],
  initial: T,
  onChange: (value: T) => void,
) {
  let current = initial;
  function render() {
    root.innerHTML = options
      .map(
        (o) =>
          `<button class="segmented-option ${o.value === current ? "selected" : ""}" data-value="${o.value}">${t(o.labelKey)}</button>`,
      )
      .join("");
  }
  render();
  onLocaleChange(render);
  root.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-value]");
    if (!target) return;
    current = target.dataset.value as T;
    render();
    onChange(current);
  });
}

/** A row of preset swatches + a custom color-wheel trigger, generic over which color it's editing. */
export function initColorPicker(
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
