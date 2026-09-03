import { getPetSvgMarkup, BORDER_STROKE_WIDTH, contrastTextColor, casePathFor } from "../../shared/petSvg";
import { initI18n, t, onLocaleChange } from "../i18nClient";
import { initSpotifyPage } from "./pages/SpotifyPage";
import { initGeneralPage } from "./pages/GeneralPage";
import { initThemePage } from "./pages/ThemePage";
import { initCasePage } from "./pages/CasePage";
import { initAnimationPage } from "./pages/AnimationPage";
import { initHistoryPage } from "./pages/HistoryPage";

await initI18n();

document.documentElement.dataset.theme = await window.petAPI.getEffectiveUiTheme();
window.petAPI.onEffectiveUiThemeChanged((theme) => {
  document.documentElement.dataset.theme = theme;
});

const brandIcon = document.getElementById("brand-icon") as HTMLElement;
const [initialLabelColor, initialCaseColor, initialShowBorder, initialBorderColor, initialDiscName, initialCaseShape] =
  await Promise.all([
    window.petAPI.getLabelColor(),
    window.petAPI.getCaseColor(),
    window.petAPI.getShowBorder(),
    window.petAPI.getBorderColor(),
    window.petAPI.getDiscName(),
    window.petAPI.getCaseShape(),
  ]);
brandIcon.innerHTML = getPetSvgMarkup(
  initialLabelColor,
  initialCaseColor,
  initialShowBorder,
  initialBorderColor,
  initialDiscName,
  initialCaseShape,
);
window.petAPI.onLabelColorChanged((color) => {
  document.getElementById("pet-label")?.setAttribute("fill", color);
});
window.petAPI.onCaseColorChanged((color) => {
  document.getElementById("pet-case")?.setAttribute("fill", color);
  document.getElementById("pet-disc-name")?.setAttribute("fill", contrastTextColor(color));
});
window.petAPI.onShowBorderChanged((show) => {
  const width = String(show ? BORDER_STROKE_WIDTH : 0);
  document.getElementById("pet-case")?.setAttribute("stroke-width", width);
  document.getElementById("pet-disc-border")?.setAttribute("stroke-width", width);
});
window.petAPI.onBorderColorChanged((color) => {
  document.getElementById("pet-case")?.setAttribute("stroke", color);
  document.getElementById("pet-disc-border")?.setAttribute("stroke", color);
});
window.petAPI.onDiscNameChanged((name) => {
  const el = document.getElementById("pet-disc-name");
  if (el) el.textContent = name;
});
window.petAPI.onCaseShapeChanged((shape) => {
  document.getElementById("pet-case")?.setAttribute("d", casePathFor(shape));
});

// Any element with data-i18n="some.key" gets its text filled in here, both
// on load and whenever the locale changes — adding a new translated string
// anywhere in settings is just adding this attribute, no JS required.
function applyTranslations() {
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
}
applyTranslations();
onLocaleChange(applyTranslations);

// Generic nav <-> page switching: works for any number of
// [data-page="x"] nav buttons / <section data-page="x"> pairs, so adding a
// new settings section later is just a new nav button + <section> + an
// init*Page() call below — nothing here needs to change.
const navItems = document.querySelectorAll<HTMLButtonElement>(".nav-item");
const pages = document.querySelectorAll<HTMLElement>(".page");

navItems.forEach((nav) => {
  nav.addEventListener("click", () => {
    const target = nav.dataset.page;
    navItems.forEach((n) => n.classList.toggle("active", n === nav));
    pages.forEach((p) => (p.hidden = p.dataset.page !== target));
  });
});

// One init call per settings page.
initSpotifyPage();
initGeneralPage();
initThemePage();
initCasePage();
initAnimationPage();
initHistoryPage();
