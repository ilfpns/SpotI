import type { PetAPI } from "../../preload/preload";

declare global {
  interface Window {
    petAPI: PetAPI;
  }
}

export {};
