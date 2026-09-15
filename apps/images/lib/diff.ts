/**
 * Pixel comparison for the Image Compare tool.
 *
 * Works on plain RGBA arrays so the maths can be tested without a canvas, and
 * so the same code serves the on-screen preview and the downloaded result.
 */

export type DiffResult = {
  /** Darkened base image with the changed pixels painted in, ready for ImageData. */
  pixels: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
  changed: number;
  total: number;
  /** Share of pixels that differ, 0–100, rounded to two places. */
  percentage: number;
  /** Tightest box containing every change, or null when the images match. */
  bounds: { x: number; y: number; width: number; height: number } | null;
};

/** Highlight colour for changed pixels — the red the reference screen uses. */
const HIGHLIGHT: [number, number, number] = [255, 45, 45];

/**
 * Sensitivity runs 0–100 in the UI. A high setting should notice more, so it
 * maps to a *smaller* tolerance: 0 → only gross changes, 100 → near-exact match
 * required.
 */
export function toleranceFor(sensitivity: number) {
  const clamped = Math.min(100, Math.max(0, sensitivity));
  return Math.round(90 - (clamped / 100) * 87);
}

/**
 * Weighted RGB distance. The green weight reflects how much of perceived
 * brightness it carries, which stops a blue-channel wobble reading as a change.
 */
function delta(a: Uint8ClampedArray, b: Uint8ClampedArray, at: number) {
  const dr = a[at] - b[at];
  const dg = a[at + 1] - b[at + 1];
  const db = a[at + 2] - b[at + 2];
  const da = a[at + 3] - b[at + 3];
  return Math.sqrt(dr * dr * 0.9 + dg * dg * 1.5 + db * db * 0.6 + da * da * 1.2);
}

export function compareImages(
  first: Uint8ClampedArray,
  second: Uint8ClampedArray,
  width: number,
  height: number,
  sensitivity: number
): DiffResult {
  const total = width * height;
  if (first.length !== second.length || first.length !== total * 4) {
    throw new Error("Both images must be compared at the same size.");
  }

  const tolerance = toleranceFor(sensitivity);
  const pixels = new Uint8ClampedArray(first.length);
  let changed = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let index = 0; index < total; index += 1) {
    const at = index * 4;
    if (delta(first, second, at) > tolerance) {
      changed += 1;
      pixels[at] = HIGHLIGHT[0];
      pixels[at + 1] = HIGHLIGHT[1];
      pixels[at + 2] = HIGHLIGHT[2];
      pixels[at + 3] = 255;

      const x = index % width;
      const y = (index - x) / width;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    } else {
      // Unchanged areas drop to a dim greyscale so the red reads immediately.
      const grey = (first[at] * 0.2126 + first[at + 1] * 0.7152 + first[at + 2] * 0.0722) * 0.38;
      pixels[at] = grey;
      pixels[at + 1] = grey;
      pixels[at + 2] = grey;
      pixels[at + 3] = 255;
    }
  }

  return {
    pixels,
    width,
    height,
    changed,
    total,
    percentage: Math.round((changed / total) * 10000) / 100,
    bounds: maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
  };
}

/**
 * The size both images are compared at: the first image's frame, so the report
 * is expressed in the coordinates of the picture the user considers original.
 */
export function comparisonSize(
  first: { width: number; height: number },
  second: { width: number; height: number },
  cap = 1600
) {
  const scale = Math.min(1, cap / Math.max(first.width, first.height));
  return {
    width: Math.max(1, Math.round(first.width * scale)),
    height: Math.max(1, Math.round(first.height * scale)),
    /** True when the second image had to be reshaped, which is worth saying. */
    rescaled: first.width !== second.width || first.height !== second.height
  };
}

export function summarise(result: DiffResult) {
  if (!result.changed) return "The two images are pixel-identical at this sensitivity.";
  const area = result.bounds
    ? ` Changes span a ${result.bounds.width} × ${result.bounds.height} px region.`
    : "";
  return `${result.changed.toLocaleString("en-US")} of ${result.total.toLocaleString("en-US")} pixels differ (${result.percentage}%).${area}`;
}
