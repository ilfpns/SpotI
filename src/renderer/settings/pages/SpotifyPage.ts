import { t, onLocaleChange } from "../../i18nClient";
import { SPOTIFY_REDIRECT_URI } from "../../../shared/constants";

function initClientId() {
  const input = document.getElementById("client-id-input") as HTMLInputElement;
  const saveButton = document.getElementById("client-id-save-button") as HTMLButtonElement;
  const statusEl = document.getElementById("client-id-status") as HTMLElement;
  const redirectEl = document.getElementById("redirect-uri-value") as HTMLElement;
  const dashboardButton = document.getElementById("open-dashboard-button") as HTMLButtonElement;

  redirectEl.textContent = SPOTIFY_REDIRECT_URI;

  function renderStatus(configured: boolean) {
    statusEl.textContent = configured ? t("clientId.status.set") : t("clientId.status.unset");
  }

  window.petAPI.spotify.getClientId().then((clientId) => {
    if (clientId) input.value = clientId;
    renderStatus(!!clientId);
  });

  saveButton.addEventListener("click", async () => {
    const value = input.value.trim();
    if (!value) return;
    await window.petAPI.spotify.setClientId(value);
    renderStatus(true);
  });

  dashboardButton.addEventListener("click", () => window.petAPI.spotify.openDashboard());
}

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

  initClientId();
}
