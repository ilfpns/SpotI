import { LOCALES, type Locale } from "../../../shared/i18n";
import type { PetSize, PollingSpeed } from "../../../shared/constants";
import { getCurrentLocale, t } from "../../i18nClient";
import { createToggle, createSegmented } from "../uiControls";

export function initGeneralPage() {
  const wrap = document.getElementById("language-select") as HTMLElement;
  const trigger = wrap.querySelector(".select-trigger") as HTMLButtonElement;
  const triggerLabel = wrap.querySelector(".select-trigger-label") as HTMLElement;
  const menu = wrap.querySelector(".select-menu") as HTMLElement;

  function labelFor(code: Locale): string {
    return LOCALES.find((l) => l.code === code)?.label ?? code;
  }

  function close() {
    wrap.classList.remove("open");
  }

  function render() {
    const current = getCurrentLocale();
    triggerLabel.textContent = labelFor(current);
    menu.innerHTML = LOCALES.map(
      (l) => `
        <button class="select-option ${l.code === current ? "selected" : ""}" data-locale="${l.code}">
          <span>${l.label}</span>
          ${l.code === current ? '<span class="option-check">✓</span>' : ""}
        </button>
      `,
    ).join("");
  }

  trigger.addEventListener("click", () => {
    wrap.classList.toggle("open");
  });

  menu.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-locale]");
    if (!target) return;
    window.petAPI.setLocale(target.dataset.locale as Locale);
    close();
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target as Node)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  render();
  window.petAPI.onLocaleChanged(() => render());

  initVolume();
  initAutoLaunch();
  initPetSize();
  initNotifyTrackChange();
  initPollingSpeed();
  initResetButton();
}

function initVolume() {
  const slider = document.getElementById("volume-slider") as HTMLInputElement;
  const valueEl = document.getElementById("volume-value") as HTMLElement;
  let debounceHandle: ReturnType<typeof setTimeout> | null = null;

  window.petAPI.spotify.getVolume().then((result) => {
    if (result.ok && result.data !== null && result.data !== undefined) {
      slider.value = String(result.data);
      valueEl.textContent = `${result.data}%`;
    }
  });

  slider.addEventListener("input", () => {
    valueEl.textContent = `${slider.value}%`;
    if (debounceHandle) clearTimeout(debounceHandle);
    debounceHandle = setTimeout(() => {
      window.petAPI.spotify.setVolume(Number(slider.value));
    }, 250);
  });
}

function initAutoLaunch() {
  const root = document.getElementById("auto-launch-toggle") as HTMLElement;
  window.petAPI.getAutoLaunch().then((value) => {
    createToggle(root, value, (next) => window.petAPI.setAutoLaunch(next));
  });
}

function initPetSize() {
  const root = document.getElementById("pet-size-segmented") as HTMLElement;
  window.petAPI.getPetSize().then((value) => {
    createSegmented<PetSize>(
      root,
      [
        { value: "small", labelKey: "size.small" },
        { value: "medium", labelKey: "size.medium" },
        { value: "large", labelKey: "size.large" },
      ],
      value,
      (next) => window.petAPI.setPetSize(next),
    );
  });
}

function initNotifyTrackChange() {
  const root = document.getElementById("notify-toggle") as HTMLElement;
  window.petAPI.getNotifyTrackChange().then((value) => {
    createToggle(root, value, (next) => window.petAPI.setNotifyTrackChange(next));
  });
}

function initResetButton() {
  const button = document.getElementById("reset-settings-button") as HTMLButtonElement;
  button.addEventListener("click", async () => {
    if (!window.confirm(t("confirm.reset"))) return;
    await window.petAPI.resetSettings();
    // Simplest way to make every control on this page (and every other
    // settings page) reflect the reset values without duplicating refresh
    // logic per control — each page's init already fetches current values
    // on load.
    location.reload();
  });
}

function initPollingSpeed() {
  const root = document.getElementById("polling-speed-segmented") as HTMLElement;
  window.petAPI.getPollingSpeed().then((value) => {
    createSegmented<PollingSpeed>(
      root,
      [
        { value: "fast", labelKey: "speed.fast" },
        { value: "normal", labelKey: "speed.normal" },
      ],
      value,
      (next) => window.petAPI.setPollingSpeed(next),
    );
  });
}
