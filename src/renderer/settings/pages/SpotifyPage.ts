import { t, onLocaleChange } from "../../i18nClient";

export function initSpotifyPage() {
  const statusEl = document.getElementById("spotify-status") as HTMLElement;
  const actionBtn = document.getElementById("spotify-action") as HTMLButtonElement;
  const runtimeEl = document.getElementById("runtime-info") as HTMLElement;

  async function refresh() {
    const status = await window.petAPI.spotify.getAuthStatus();
    if (status.authenticated) {
      statusEl.textContent = t("status.connected");
      actionBtn.textContent = t("button.disconnect");
      actionBtn.hidden = false;
      actionBtn.onclick = async () => {
        await window.petAPI.spotify.logout();
        refresh();
      };
    } else {
      statusEl.textContent = t("status.disconnected");
      actionBtn.hidden = true;
    }
  }

  const runtime = window.petAPI.getRuntimeInfo();
  runtimeEl.textContent = `Electron ${runtime.electron} · Chromium ${runtime.chrome} · ${runtime.platform}`;

  window.petAPI.spotify.onAuthStatusChanged(() => refresh());
  onLocaleChange(() => refresh());
  refresh();
}
