import type { CaseSlideSpeed, DiscSpinSpeed } from "../../../shared/constants";
import { createSegmented } from "../uiControls";

export async function initAnimationPage() {
  const caseSlideRoot = document.getElementById("case-slide-speed-segmented") as HTMLElement;
  const currentCaseSlideSpeed = await window.petAPI.getCaseSlideSpeed();
  createSegmented<CaseSlideSpeed>(
    caseSlideRoot,
    [
      { value: "slow", labelKey: "speed.slow" },
      { value: "normal", labelKey: "speed.normal" },
      { value: "fast", labelKey: "speed.fast" },
    ],
    currentCaseSlideSpeed,
    (next) => window.petAPI.setCaseSlideSpeed(next),
  );

  const discSpinRoot = document.getElementById("disc-spin-speed-segmented") as HTMLElement;
  const currentDiscSpinSpeed = await window.petAPI.getDiscSpinSpeed();
  createSegmented<DiscSpinSpeed>(
    discSpinRoot,
    [
      { value: "slow", labelKey: "speed.slow" },
      { value: "normal", labelKey: "speed.normal" },
      { value: "fast", labelKey: "speed.fast" },
    ],
    currentDiscSpinSpeed,
    (next) => window.petAPI.setDiscSpinSpeed(next),
  );
}
