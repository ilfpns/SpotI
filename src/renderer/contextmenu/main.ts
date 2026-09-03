import { initI18n, t } from "../i18nClient";

await initI18n();

document.documentElement.dataset.theme = await window.petAPI.getUiTheme();
window.petAPI.onUiThemeChanged((theme) => {
  document.documentElement.dataset.theme = theme;
});

document.getElementById("menu-settings")!.textContent = t("menu.settings");
document.getElementById("menu-open-spotify")!.textContent = t("menu.openSpotify");
document.getElementById("menu-quit")!.textContent = t("menu.quit");

document.querySelectorAll<HTMLButtonElement>(".menu-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action as "settings" | "quit" | "openSpotify";
    window.petAPI.contextMenuAction(action);
  });
});
