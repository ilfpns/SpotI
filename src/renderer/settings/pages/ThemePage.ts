import { type UiThemePreference } from "../../../shared/theme";
import { createSegmented, createToggle, initColorPicker } from "../uiControls";

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

  const followRoot = document.getElementById("follow-now-playing-toggle") as HTMLElement;
  window.petAPI.getFollowNowPlayingColor().then((value) => {
    createToggle(followRoot, value, (next) => window.petAPI.setFollowNowPlayingColor(next));
  });

  const uiThemeRoot = document.getElementById("ui-theme-segmented") as HTMLElement;
  const current = await window.petAPI.getUiTheme();
  createSegmented<UiThemePreference>(
    uiThemeRoot,
    [
      { value: "dark", labelKey: "uiTheme.dark" },
      { value: "light", labelKey: "uiTheme.light" },
      { value: "system", labelKey: "uiTheme.system" },
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
