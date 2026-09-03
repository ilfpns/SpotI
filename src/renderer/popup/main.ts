import { PopupPanel } from "./PopupPanel";
import { initI18n } from "../i18nClient";
import { DEFAULT_FONT_COLOR } from "../../shared/theme";

await initI18n();

document.documentElement.dataset.theme = await window.petAPI.getEffectiveUiTheme();
window.petAPI.onEffectiveUiThemeChanged((theme) => {
  document.documentElement.dataset.theme = theme;
});

// Only override the CSS custom property once the user actually picks a
// custom color — otherwise leave --font-color alone so the stylesheet's own
// theme-aware default (light vs. dark) keeps applying.
function applyFontColor(color: string) {
  if (color.toLowerCase() === DEFAULT_FONT_COLOR.toLowerCase()) {
    document.documentElement.style.removeProperty("--font-color");
  } else {
    document.documentElement.style.setProperty("--font-color", color);
  }
}
applyFontColor(await window.petAPI.getFontColor());
window.petAPI.onFontColorChanged(applyFontColor);

const root = document.getElementById("popup") as HTMLDivElement;
const panel = new PopupPanel(root);

window.petAPI.onPopupAppear((side) => panel.appear(side));
window.petAPI.onPopupDisappear((side) => panel.disappear(side));
