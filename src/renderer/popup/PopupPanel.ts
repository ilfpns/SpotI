import { TrackInfo } from "./TrackInfo";
import { ProgressBar } from "./ProgressBar";
import { PlaybackControls } from "./PlaybackControls";
import { t, onLocaleChange } from "../i18nClient";
import type { AuthStatus } from "../../shared/types";

export class PopupPanel {
  private root: HTMLElement;
  private authenticatedSection: HTMLElement;
  private unauthenticatedSection: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;

    // The rounded, painted card is a separate element from the one the
    // enter/exit animation transforms — combining border-radius+overflow
    // clipping with a live `transform` on the same element left a stray
    // unrounded sliver at the edge in Chromium, so the two are split here.
    const card = document.createElement("div");
    card.className = "card";
    root.appendChild(card);

    this.unauthenticatedSection = document.createElement("div");
    this.unauthenticatedSection.className = "connect-message";
    card.appendChild(this.unauthenticatedSection);
    this.renderConnectMessage();
    onLocaleChange(() => this.renderConnectMessage());

    this.authenticatedSection = document.createElement("div");
    this.authenticatedSection.innerHTML = `
      <div class="np-row">
        <div class="np-disc"></div>
        <div class="np-right">
          <div class="np-meta"></div>
          <div class="np-controls"></div>
        </div>
      </div>
      <div class="np-progress"></div>
    `;
    card.appendChild(this.authenticatedSection);

    const discEl = this.authenticatedSection.querySelector(".np-disc") as HTMLElement;
    const metaEl = this.authenticatedSection.querySelector(".np-meta") as HTMLElement;
    const controlsEl = this.authenticatedSection.querySelector(".np-controls") as HTMLElement;
    const progressEl = this.authenticatedSection.querySelector(".np-progress") as HTMLElement;

    new TrackInfo(discEl, metaEl);
    new PlaybackControls(controlsEl);
    new ProgressBar(progressEl);

    // Event delegation: renderConnectMessage() replaces this subtree's
    // innerHTML on every locale change, so a listener bound directly to the
    // button would get lost — bind it on the stable container instead.
    this.unauthenticatedSection.addEventListener("click", async (e) => {
      if (!(e.target as HTMLElement).closest(".login-button")) return;
      const result = await window.petAPI.spotify.login();
      if (!result.ok && result.message) {
        const msg = document.createElement("div");
        msg.className = "status-message";
        msg.textContent = result.message;
        this.unauthenticatedSection.appendChild(msg);
      }
    });

    window.petAPI.spotify.onAuthStatusChanged((status) => this.applyAuthStatus(status));
    window.petAPI.spotify.getAuthStatus().then((status) => this.applyAuthStatus(status));
  }

  private renderConnectMessage() {
    this.unauthenticatedSection.innerHTML = `
      <div class="status-message" style="margin-bottom:8px">${t("popup.connectMessage")}</div>
      <button class="login-button">${t("popup.connectButton")}</button>
    `;
  }

  private applyAuthStatus(status: AuthStatus) {
    this.unauthenticatedSection.hidden = status.authenticated;
    this.authenticatedSection.hidden = !status.authenticated;
  }

  // When the popup sits ABOVE the pet, its bottom edge faces the pet, so the
  // grow/shrink animation should anchor there (and vice versa).
  private setSide(side: "above" | "below") {
    this.root.classList.toggle("anchor-bottom", side === "above");
    this.root.classList.toggle("anchor-top", side === "below");
  }

  appear(side: "above" | "below") {
    this.setSide(side);
    this.root.classList.remove("fast-exit");
    this.root.classList.add("visible");
  }

  disappear(side: "above" | "below") {
    this.setSide(side);
    this.root.classList.add("fast-exit");
    this.root.classList.remove("visible");
  }
}
