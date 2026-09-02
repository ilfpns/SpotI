import { t, onLocaleChange } from "../i18nClient";

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
