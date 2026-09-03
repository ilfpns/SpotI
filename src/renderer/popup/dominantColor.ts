// A small offscreen canvas reused across calls instead of creating a new
// one per track — this runs on every track change once "follow now
// playing" is on.
const SAMPLE_SIZE = 24;
const canvas = document.createElement("canvas");
canvas.width = SAMPLE_SIZE;
canvas.height = SAMPLE_SIZE;
const ctx = canvas.getContext("2d", { willReadFrequently: true });

/**
 * Picks a representative color from an already-loaded image by averaging
 * its pixels, weighted toward more saturated/mid-brightness ones so a
 * vivid color in the art wins over large flat black/white backgrounds
 * instead of just producing a muddy average.
 *
 * Returns null if the image hasn't finished loading or the canvas read is
 * blocked (a cross-origin image without CORS headers taints the canvas) —
 * callers should treat that as "leave the color as it was."
 */
export function extractDominantColor(img: HTMLImageElement): string | null {
  if (!ctx || !img.complete || img.naturalWidth === 0) return null;

  try {
    ctx.clearRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let weightSum = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];
      if (alpha < 200) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lightness = (max + min) / 2 / 255;
      const saturation = max === min ? 0 : (max - min) / 255;
      // Down-weight near-black/near-white and low-saturation (grey) pixels
      // so a splash of real color outweighs a big flat background.
      const lightnessWeight = 1 - Math.abs(lightness - 0.5) * 1.6;
      const weight = Math.max(0.05, lightnessWeight) * (0.3 + saturation);

      rSum += r * weight;
      gSum += g * weight;
      bSum += b * weight;
      weightSum += weight;
    }

    if (weightSum === 0) return null;
    const r = Math.round(rSum / weightSum);
    const g = Math.round(gSum / weightSum);
    const b = Math.round(bSum / weightSum);
    return `#${[r, g, b].map((c) => Math.min(255, Math.max(0, c)).toString(16).padStart(2, "0")).join("")}`;
  } catch {
    // Tainted canvas (no CORS) or any other read failure — feature just
    // silently no-ops rather than breaking now-playing rendering.
    return null;
  }
}
