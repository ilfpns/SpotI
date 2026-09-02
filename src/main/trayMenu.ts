import { Tray, Menu, app } from "electron";
import { getPetIcon } from "./petIcon";
import { showSettingsWindow } from "./windows/settingsWindow";
import { registerTrayIconSetter } from "./ipc/registerIpcHandlers";

let tray: Tray | null = null;

export async function createTray(): Promise<Tray> {
  const icon = await getPetIcon();
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("SpotI");
  registerTrayIconSetter((newIcon) => tray?.setImage(newIcon.resize({ width: 16, height: 16 })));

  const menu = Menu.buildFromTemplate([
    { label: "SpotI", enabled: false },
    { type: "separator" },
    { label: "설정", click: () => showSettingsWindow() },
    { label: "종료", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);

  return tray;
}
