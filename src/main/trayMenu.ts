import { Tray, Menu, app } from "electron";
import { getPetIcon } from "./petIcon";
import { showSettingsWindow } from "./windows/settingsWindow";
import { getPetWindow } from "./windows/petWindow";
import { registerTrayIconSetter, registerTrayMenuRebuilder } from "./ipc/registerIpcHandlers";
import { getLocale } from "./localeStore";
import { translate } from "../shared/i18n";

let tray: Tray | null = null;

function buildMenu(): Menu {
  const locale = getLocale();
  const petWin = getPetWindow();
  const petVisible = !petWin.isDestroyed() && petWin.isVisible();

  return Menu.buildFromTemplate([
    { label: "SpotI", enabled: false },
    { type: "separator" },
    {
      label: translate(locale, petVisible ? "tray.hidePet" : "tray.showPet"),
      click: () => {
        if (petWin.isDestroyed()) return;
        if (petWin.isVisible()) petWin.hide();
        else petWin.show();
        rebuildTrayMenu();
      },
    },
    { label: translate(locale, "menu.settings"), click: () => showSettingsWindow() },
    { label: translate(locale, "menu.quit"), click: () => app.quit() },
  ]);
}

function rebuildTrayMenu(): void {
  tray?.setContextMenu(buildMenu());
}

export async function createTray(): Promise<Tray> {
  const icon = await getPetIcon();
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("SpotI");
  registerTrayIconSetter((newIcon) => tray?.setImage(newIcon.resize({ width: 16, height: 16 })));
  registerTrayMenuRebuilder(rebuildTrayMenu);
  tray.setContextMenu(buildMenu());

  return tray;
}
