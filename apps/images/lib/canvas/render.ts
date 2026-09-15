import {
  boxBlur, context, cornerRadii, createCanvas, gaussianBlur, grayscale, hexToRgba, lensBlur,
  motionBlur, roundedPath, strokeBorder, unsharpMask,
  type BorderStyle, type CornerSelection, type GrayscaleMode
} from "@/lib/canvas/effects";
import type { SourceImage, ToolOptions } from "@/lib/canvas/types";
import type { ToolId } from "@/lib/tools";

/** Previews render at this cap so large photos stay interactive while editing. */
export const PREVIEW_MAX = 1400;

const num = (options: ToolOptions, key: string, fallback: number) => {
  const raw = options[key];
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) ? value : fallback;
};
const str = (options: ToolOptions, key: string, fallback: string) => {
  const raw = options[key];
  return raw === undefined || raw === "" ? fallback : String(raw);
};
const bool = (options: ToolOptions, key: string, fallback: boolean) => {
  const raw = options[key];
  if (raw === undefined) return fallback;
  return raw === true || raw === "true";
};

export type RenderResult = { canvas: HTMLCanvasElement; width: number; height: number; scale: number };

/** Images a tool needs besides the source, such as the watermark logo. */
export type RenderAssets = { overlay?: HTMLImageElement | null };

/**
 * Renders `tool` against `source`. `maxSize` caps the working resolution; every
 * pixel-denominated option is multiplied by the same scale so a preview is a
 * faithful miniature of the exported file.
 */
export function render(tool: ToolId, source: SourceImage, options: ToolOptions, maxSize = Infinity, assets: RenderAssets = {}): RenderResult {
  const longest = Math.max(source.width, source.height);
  const scale = Number.isFinite(maxSize) && longest > maxSize ? maxSize / longest : 1;
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const base = createCanvas(width, height);
  const baseCtx = context(base);
  baseCtx.imageSmoothingQuality = "high";
  baseCtx.drawImage(source.element, 0, 0, width, height);

  let canvas = applyTool(tool, base, options, scale, assets);

  // Blur and grayscale destroy detail, so halving the export is a real saving
  // rather than a cosmetic switch. Previews skip it — they are already scaled.
  if (!Number.isFinite(maxSize) && (tool === "blur-image" || tool === "grayscale-image") && !bool(options, "keepSize", true)) {
    canvas = downscale(canvas, 0.5);
  }

  return { canvas, width: canvas.width, height: canvas.height, scale };
}

function applyTool(
  tool: ToolId,
  base: HTMLCanvasElement,
  options: ToolOptions,
  scale: number,
  assets: RenderAssets
): HTMLCanvasElement {
  switch (tool) {
    case "blur-image": return blur(base, options, scale);
    case "sharpen-image": return sharpen(base, options, scale);
    case "grayscale-image": return toGrayscale(base, options);
    case "rounded-corners": return roundCorners(base, options, scale);
    case "add-border": return addBorder(base, options, scale);
    case "watermark-image": return watermark(base, options, scale, assets.overlay ?? null);
    default: return base;
  }
}

function downscale(source: HTMLCanvasElement, factor: number) {
  const canvas = createCanvas(source.width * factor, source.height * factor);
  const ctx = context(canvas);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/* -------------------------------------------------------------------------- */

function blur(base: HTMLCanvasElement, options: ToolOptions, scale: number) {
  const intensity = Math.max(0, num(options, "intensity", 10)) * scale;
  if (intensity <= 0) return base;
  const type = str(options, "blurType", "gaussian");

  // "Apply to entire image" off means the subject stays sharp and only the
  // surroundings are softened, which is the lens treatment.
  if (!bool(options, "wholeImage", true)) return lensBlur(base, base.width, base.height, intensity);
  if (type === "motion") return motionBlur(base, base.width, base.height, intensity * 2);
  if (type === "lens") return lensBlur(base, base.width, base.height, intensity);
  if (type === "box") {
    const canvas = createCanvas(base.width, base.height);
    const ctx = context(canvas);
    ctx.drawImage(base, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.putImageData(boxBlur(data, intensity), 0, 0);
    return canvas;
  }
  return gaussianBlur(base, base.width, base.height, intensity);
}

function sharpen(base: HTMLCanvasElement, options: ToolOptions, scale: number) {
  const intensity = Math.max(0, Math.min(100, num(options, "intensity", 50)));
  if (intensity === 0) return base;

  const preserveColors = bool(options, "preserveColors", true);
  const reduceNoise = bool(options, "reduceNoise", true);
  const enhanceEdges = bool(options, "enhanceEdges", true);

  // A wider radius with noise reduction avoids amplifying sensor grain.
  const radius = Math.max(0.6, (reduceNoise ? 1.6 : 0.9) * scale);
  const amount = (intensity / 100) * (enhanceEdges ? 1.9 : 1.2);

  const canvas = createCanvas(base.width, base.height);
  const ctx = context(canvas);
  ctx.drawImage(base, 0, 0);
  const original = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const blurred = gaussianBlur(base, base.width, base.height, radius);
  const blurredData = context(blurred).getImageData(0, 0, blurred.width, blurred.height);

  ctx.putImageData(unsharpMask(original, blurredData, amount, preserveColors), 0, 0);
  return canvas;
}

function toGrayscale(base: HTMLCanvasElement, options: ToolOptions) {
  const canvas = createCanvas(base.width, base.height);
  const ctx = context(canvas);
  ctx.drawImage(base, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mode = str(options, "mode", "desaturate") as GrayscaleMode;
  ctx.putImageData(grayscale(data, mode, num(options, "brightness", 0), num(options, "contrast", 0)), 0, 0);
  return canvas;
}

function roundCorners(base: HTMLCanvasElement, options: ToolOptions, scale: number) {
  const radius = Math.max(0, num(options, "radius", 32)) * scale;
  const selection = str(options, "cornerStyle", "all") as CornerSelection;
  const custom: [number, number, number, number] = [
    num(options, "radiusTopLeft", 32) * scale,
    num(options, "radiusTopRight", 32) * scale,
    num(options, "radiusBottomRight", 32) * scale,
    num(options, "radiusBottomLeft", 32) * scale
  ];

  const canvas = createCanvas(base.width, base.height);
  const ctx = context(canvas);
  if (str(options, "background", "transparent") === "color") {
    ctx.fillStyle = str(options, "backgroundColor", "#FFFFFF");
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.save();
  roundedPath(ctx, 0, 0, canvas.width, canvas.height, cornerRadii(selection, radius, custom));
  ctx.clip();
  ctx.drawImage(base, 0, 0);
  ctx.restore();
  return canvas;
}

function addBorder(base: HTMLCanvasElement, options: ToolOptions, scale: number) {
  const thickness = Math.max(0, num(options, "thickness", 20)) * scale;
  if (thickness <= 0) return base;

  const style = str(options, "borderStyle", "solid") as BorderStyle;
  const color = str(options, "borderColor", "#3B82F6");
  const corner = str(options, "cornerStyle", "square");
  const grow = bool(options, "changeOutputSize", true);

  const outWidth = grow ? base.width + thickness * 2 : base.width;
  const outHeight = grow ? base.height + thickness * 2 : base.height;
  const canvas = createCanvas(outWidth, outHeight);
  const ctx = context(canvas);

  const radius = corner === "circle"
    ? Math.min(outWidth, outHeight) / 2
    : corner === "rounded"
      ? Math.min(outWidth, outHeight) * 0.06 + thickness
      : 0;

  // The photo is clipped to the same silhouette as the frame so rounded and
  // circular borders do not leave square corners peeking out behind them.
  ctx.save();
  roundedPath(ctx, thickness, thickness, outWidth - thickness * 2, outHeight - thickness * 2,
    cornerRadii("all", Math.max(0, radius - thickness), undefined));
  ctx.clip();
  if (grow) ctx.drawImage(base, thickness, thickness, outWidth - thickness * 2, outHeight - thickness * 2);
  else ctx.drawImage(base, 0, 0);
  ctx.restore();

  strokeBorder(ctx, style, color, thickness, (inset, lineWidth) => {
    const r = Math.max(0, radius - inset);
    roundedPath(ctx, inset, inset, outWidth - inset * 2, outHeight - inset * 2, cornerRadii("all", r, undefined));
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  });

  return canvas;
}

const ANCHORS: Record<string, [number, number]> = {
  "top-left": [0.12, 0.14], "top-center": [0.5, 0.14], "top-right": [0.88, 0.14],
  "middle-left": [0.12, 0.5], "middle-center": [0.5, 0.5], "middle-right": [0.88, 0.5],
  "bottom-left": [0.12, 0.86], "bottom-center": [0.5, 0.86], "bottom-right": [0.88, 0.86]
};

const FONTS: Record<string, string> = {
  inter: "Inter, system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'DM Mono', ui-monospace, monospace",
  condensed: "'Arial Narrow', Inter, sans-serif"
};

/**
 * The image watermark: sized as a share of the photo's width, so the preview and
 * the export match, and kept inside the frame at the edge positions.
 */
function drawImageMark(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, mark: HTMLImageElement, options: ToolOptions) {
  const width = canvas.width * (Math.min(100, Math.max(2, num(options, "logoSize", 25))) / 100);
  const height = width * (mark.naturalHeight / Math.max(1, mark.naturalWidth));
  const [anchorX, anchorY] = ANCHORS[str(options, "position", "middle-center")] ?? ANCHORS["middle-center"];
  const x = Math.min(canvas.width - width / 2, Math.max(width / 2, canvas.width * anchorX));
  const y = Math.min(canvas.height - height / 2, Math.max(height / 2, canvas.height * anchorY));
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, num(options, "opacity", 50) / 100));
  ctx.translate(x, y);
  ctx.rotate((num(options, "rotation", 0) * Math.PI) / 180);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mark, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function watermark(base: HTMLCanvasElement, options: ToolOptions, scale: number, overlay: HTMLImageElement | null) {
  const canvas = createCanvas(base.width, base.height);
  const ctx = context(canvas);
  ctx.drawImage(base, 0, 0);

  if (str(options, "mode", "text") === "image") {
    if (overlay) drawImageMark(ctx, canvas, overlay, options);
    return canvas;
  }

  const text = str(options, "text", "UtilFoundry");
  if (!text.trim()) return canvas;

  const fontSize = Math.max(6, num(options, "fontSize", 72) * scale);
  const opacity = Math.min(1, Math.max(0, num(options, "opacity", 50) / 100));
  const [anchorX, anchorY] = ANCHORS[str(options, "position", "middle-center")] ?? ANCHORS["middle-center"];
  const rotation = (num(options, "rotation", -30) * Math.PI) / 180;

  ctx.save();
  ctx.translate(canvas.width * anchorX, canvas.height * anchorY);
  ctx.rotate(rotation);
  ctx.font = `700 ${fontSize}px ${FONTS[str(options, "font", "inter")] ?? FONTS.inter}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (bool(options, "shadow", true)) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
    ctx.shadowBlur = fontSize * 0.14;
    ctx.shadowOffsetY = fontSize * 0.04;
  }
  ctx.fillStyle = hexToRgba(str(options, "textColor", "#FFFFFF"), opacity);
  ctx.fillText(text, 0, 0);
  ctx.shadowColor = "transparent";

  if (bool(options, "outline", false)) {
    ctx.lineWidth = Math.max(1, fontSize * 0.035);
    ctx.strokeStyle = hexToRgba(str(options, "outlineColor", "#111C3D"), opacity);
    ctx.strokeText(text, 0, 0);
  }
  ctx.restore();
  return canvas;
}
