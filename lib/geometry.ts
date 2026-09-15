/**
 * Plain geometry for the interactive editors: the crop box and free rotation.
 * No DOM here, so every drag rule is unit-tested rather than eyeballed.
 */

export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };

/** Corner and edge handles, plus dragging the whole box. */
export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "move";

export const HANDLES: Exclude<Handle, "move">[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export type AspectPreset = { id: string; label: string; caption: string; ratio: number | null };

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: "free", label: "Free", caption: "Free", ratio: null },
  { id: "1:1", label: "1:1", caption: "Square", ratio: 1 },
  { id: "4:3", label: "4:3", caption: "Standard", ratio: 4 / 3 },
  { id: "16:9", label: "16:9", caption: "Widescreen", ratio: 16 / 9 },
  { id: "3:2", label: "3:2", caption: "Photo", ratio: 3 / 2 },
  { id: "9:16", label: "9:16", caption: "Portrait", ratio: 9 / 16 },
  { id: "4:5", label: "4:5", caption: "Instagram", ratio: 4 / 5 }
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Whole-pixel rectangle that lies entirely inside `bounds`. */
export function normalizeRect(rect: Rect, bounds: Size): Rect {
  const width = clamp(Math.round(rect.width), 1, bounds.width);
  const height = clamp(Math.round(rect.height), 1, bounds.height);
  return {
    x: clamp(Math.round(rect.x), 0, bounds.width - width),
    y: clamp(Math.round(rect.y), 0, bounds.height - height),
    width,
    height
  };
}

/** The starting selection: 80% of the image, centred, in the requested shape. */
export function initialCrop(bounds: Size, ratio: number | null): Rect {
  if (!ratio) {
    return normalizeRect({ x: bounds.width * 0.1, y: bounds.height * 0.1, width: bounds.width * 0.8, height: bounds.height * 0.8 }, bounds);
  }
  const width = Math.min(bounds.width * 0.8, bounds.height * 0.8 * ratio);
  const height = width / ratio;
  return normalizeRect({ x: (bounds.width - width) / 2, y: (bounds.height - height) / 2, width, height }, bounds);
}

/**
 * Reshapes `rect` to `ratio` around its own centre, shrinking only as far as it
 * must to stay inside the image.
 */
export function fitToRatio(rect: Rect, ratio: number, bounds: Size): Rect {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  let width = rect.width;
  let height = width / ratio;
  if (height > bounds.height) { height = bounds.height; width = height * ratio; }
  if (width > bounds.width) { width = bounds.width; height = width / ratio; }
  return normalizeRect({ x: cx - width / 2, y: cy - height / 2, width, height }, bounds);
}

/**
 * Applies a drag of (`dx`, `dy`) image pixels to the selection that existed when
 * the drag began. Corners pivot on the opposite corner, edges on the opposite
 * edge, and a locked ratio is kept exactly — the box stops at the image edge
 * rather than bending out of shape.
 */
export function dragRect(start: Rect, handle: Handle, dx: number, dy: number, bounds: Size, ratio: number | null, min = 16): Rect {
  const W = bounds.width;
  const H = bounds.height;

  if (handle === "move") {
    return {
      ...start,
      x: clamp(start.x + dx, 0, W - start.width),
      y: clamp(start.y + dy, 0, H - start.height)
    };
  }

  const left = start.x;
  const top = start.y;
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.includes("n");
  const south = handle.includes("s");

  if (!ratio) {
    let l = left;
    let t = top;
    let r = right;
    let b = bottom;
    if (west) l = clamp(left + dx, 0, r - min);
    if (east) r = clamp(right + dx, l + min, W);
    if (north) t = clamp(top + dy, 0, b - min);
    if (south) b = clamp(bottom + dy, t + min, H);
    return { x: l, y: t, width: r - l, height: b - t };
  }

  // Corners: the opposite corner is the anchor, and the pointer's larger reach
  // decides the size so the box follows whichever way the user pulls hardest.
  if ((west || east) && (north || south)) {
    const ax = west ? right : left;
    const ay = north ? bottom : top;
    const px = (west ? left : right) + dx;
    const py = (north ? top : bottom) + dy;
    const reachX = Math.max(0, west ? ax - px : px - ax);
    const reachY = Math.max(0, north ? ay - py : py - ay);
    const maxWidth = Math.min(west ? ax : W - ax, (north ? ay : H - ay) * ratio);
    const floor = Math.min(maxWidth, min * Math.max(1, ratio));
    const width = clamp(Math.max(reachX, reachY * ratio), floor, maxWidth);
    const height = width / ratio;
    return { x: west ? ax - width : ax, y: north ? ay - height : ay, width, height };
  }

  // Side edges: width follows the pointer, height follows the ratio, and the
  // box stays centred on its original horizontal midline.
  if (west || east) {
    const cy = top + start.height / 2;
    const maxWidth = Math.min(west ? right : W - left, 2 * Math.min(cy, H - cy) * ratio);
    const floor = Math.min(maxWidth, min * Math.max(1, ratio));
    const width = clamp(west ? right - (left + dx) : right + dx - left, floor, maxWidth);
    const height = width / ratio;
    return { x: west ? right - width : left, y: cy - height / 2, width, height };
  }

  const cx = left + start.width / 2;
  const maxHeight = Math.min(north ? bottom : H - top, (2 * Math.min(cx, W - cx)) / ratio);
  const floor = Math.min(maxHeight, min * Math.max(1, 1 / ratio));
  const height = clamp(north ? bottom - (top + dy) : bottom + dy - top, floor, maxHeight);
  const width = height * ratio;
  return { x: cx - width / 2, y: north ? bottom - height : top, width, height };
}

/* -------------------------------------------------------------------------- */
/* Rotation                                                                   */
/* -------------------------------------------------------------------------- */

/** Wraps any angle into (-180, 180]. */
export function normalizeAngle(degrees: number) {
  let value = ((degrees % 360) + 360) % 360;
  if (value > 180) value -= 360;
  return value;
}

/** True when the angle is a multiple of 90°, the case that needs no resampling. */
export function isQuarterTurn(degrees: number) {
  return Math.abs(normalizeAngle(degrees)) % 90 === 0;
}

/** Canvas size that holds a `size` image rotated by `degrees` without clipping. */
export function rotatedSize(size: Size, degrees: number): Size {
  const radians = (normalizeAngle(degrees) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  // Quarter turns are exact; rounding the trig away avoids a stray 1 px.
  const snap = (value: number) => (Math.abs(value - Math.round(value)) < 1e-9 ? Math.round(value) : value);
  return {
    width: Math.round(snap(size.width * cos + size.height * sin)),
    height: Math.round(snap(size.width * sin + size.height * cos))
  };
}

export type Orientation = { rotation: number; flipH: boolean; flipV: boolean };

export const NO_CHANGE: Orientation = { rotation: 0, flipH: false, flipV: false };

/** Applies one toolbar action to the current orientation. */
export function applyOrientation(current: Orientation, action: "left" | "right" | "half" | "flipH" | "flipV"): Orientation {
  if (action === "left") return { ...current, rotation: normalizeAngle(current.rotation - 90) };
  if (action === "right") return { ...current, rotation: normalizeAngle(current.rotation + 90) };
  if (action === "half") return { ...current, rotation: normalizeAngle(current.rotation + 180) };
  if (action === "flipH") return { ...current, flipH: !current.flipH };
  return { ...current, flipV: !current.flipV };
}

export function describeOrientation({ rotation, flipH, flipV }: Orientation) {
  const parts: string[] = [];
  if (rotation) parts.push(`${rotation > 0 ? "" : "−"}${Math.abs(rotation)}°`);
  if (flipH) parts.push("flipped horizontally");
  if (flipV) parts.push("flipped vertically");
  return parts.length ? parts.join(", ") : "Original";
}

/* -------------------------------------------------------------------------- */
/* Resizing                                                                   */
/* -------------------------------------------------------------------------- */

/** How an image meets a target box — the same four words Sharp and CSS use. */
export type FitMode = "contain" | "cover" | "fill" | "inside";

/** Source rectangle, destination rectangle and canvas size for one draw. */
export type DrawPlan = { canvas: Size; sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number };

export function planResize(source: Size, target: Size, fit: FitMode): DrawPlan {
  const tw = Math.max(1, Math.round(target.width));
  const th = Math.max(1, Math.round(target.height));
  const whole = { sx: 0, sy: 0, sw: source.width, sh: source.height };

  if (fit === "fill") return { canvas: { width: tw, height: th }, ...whole, dx: 0, dy: 0, dw: tw, dh: th };

  if (fit === "cover") {
    // Fill the box, cropping the overflowing axis out of the centre.
    const scale = Math.max(tw / source.width, th / source.height);
    const sw = tw / scale;
    const sh = th / scale;
    return { canvas: { width: tw, height: th }, sx: (source.width - sw) / 2, sy: (source.height - sh) / 2, sw, sh, dx: 0, dy: 0, dw: tw, dh: th };
  }

  const scale = Math.min(tw / source.width, th / source.height);
  const dw = Math.max(1, Math.round(source.width * scale));
  const dh = Math.max(1, Math.round(source.height * scale));
  // Inside shrinks the canvas to the image; contain keeps the box and letterboxes.
  if (fit === "inside") return { canvas: { width: dw, height: dh }, ...whole, dx: 0, dy: 0, dw, dh };
  return { canvas: { width: tw, height: th }, ...whole, dx: Math.round((tw - dw) / 2), dy: Math.round((th - dh) / 2), dw, dh };
}

export type ResizeRequest = {
  mode: "pixels" | "percentage" | "preset";
  width: number;
  height: number;
  percentage: number;
  keepAspect: boolean;
  preventEnlargement: boolean;
};

/**
 * The box the image is resized into. Missing sides are derived from the
 * source's shape; "prevent enlargement" shrinks the whole box uniformly so the
 * requested shape survives even when the size cannot.
 */
export function resolveResizeTarget(source: Size, request: ResizeRequest): Size {
  const ratio = source.width / source.height;
  let width: number;
  let height: number;

  if (request.mode === "percentage") {
    const factor = clamp(request.percentage, 1, 400) / 100;
    width = source.width * factor;
    height = source.height * factor;
  } else {
    width = request.width > 0 ? request.width : 0;
    height = request.height > 0 ? request.height : 0;
    if (request.mode === "pixels" && request.keepAspect) {
      if (width) height = width / ratio;
      else if (height) width = height * ratio;
    }
    if (!width && !height) { width = source.width; height = source.height; }
    else if (!width) width = height * ratio;
    else if (!height) height = width / ratio;
  }

  if (request.preventEnlargement && (width > source.width || height > source.height)) {
    const shrink = Math.min(source.width / width, source.height / height);
    width *= shrink;
    height *= shrink;
  }

  return { width: clamp(Math.round(width), 1, 12000), height: clamp(Math.round(height), 1, 12000) };
}
