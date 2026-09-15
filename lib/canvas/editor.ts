/**
 * Canvas operations for the single-image editors: orientation, resizing and
 * cropping. The geometry is decided in `lib/geometry.ts`; this file only draws.
 */

import { context, createCanvas } from "@/lib/canvas/effects";
import { canvasToBlob, encodeCanvas } from "@/lib/canvas/encode";
import {
  isQuarterTurn, normalizeAngle, planResize, rotatedSize,
  type FitMode, type Orientation, type Rect, type Size
} from "@/lib/geometry";

/**
 * Rotates and mirrors `source`. Quarter turns land on the pixel grid exactly;
 * free angles grow the canvas so nothing is clipped, and `background` fills the
 * exposed corners (left transparent when it is null).
 */
export function orient(
  source: CanvasImageSource,
  size: Size,
  orientation: Orientation,
  { background = null, scale = 1 }: { background?: string | null; scale?: number } = {}
) {
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  const out = rotatedSize({ width, height }, orientation.rotation);
  const canvas = createCanvas(out.width, out.height);
  const ctx = context(canvas);
  ctx.imageSmoothingQuality = "high";

  if (background && !isQuarterTurn(orientation.rotation)) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, out.width, out.height);
  }

  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((normalizeAngle(orientation.rotation) * Math.PI) / 180);
  ctx.scale(orientation.flipH ? -1 : 1, orientation.flipV ? -1 : 1);
  ctx.drawImage(source, -width / 2, -height / 2, width, height);
  return canvas;
}

/**
 * Resizes with repeated halving before the final draw. A single large
 * downscale samples too few source pixels and shimmers; halving first is the
 * classic fix and costs little.
 */
export function resizeImage(source: CanvasImageSource, size: Size, target: Size, fit: FitMode, background: string | null = null) {
  const plan = planResize(size, target, fit);
  let region: CanvasImageSource = source;
  let { sx, sy, sw, sh } = plan;

  while (sw >= plan.dw * 2 && sh >= plan.dh * 2 && sw > 2 && sh > 2) {
    const half = createCanvas(Math.max(1, Math.round(sw / 2)), Math.max(1, Math.round(sh / 2)));
    const halfCtx = context(half);
    halfCtx.imageSmoothingQuality = "high";
    halfCtx.drawImage(region, sx, sy, sw, sh, 0, 0, half.width, half.height);
    region = half;
    sx = 0;
    sy = 0;
    sw = half.width;
    sh = half.height;
  }

  const canvas = createCanvas(plan.canvas.width, plan.canvas.height);
  const ctx = context(canvas);
  ctx.imageSmoothingQuality = "high";
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(region, sx, sy, sw, sh, plan.dx, plan.dy, plan.dw, plan.dh);
  return canvas;
}

export function cropImage(source: CanvasImageSource, rect: Rect) {
  const canvas = createCanvas(rect.width, rect.height);
  context(canvas).drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return canvas;
}

/** "Keep original" resolves to the source's own codec where a browser can write it. */
export function resolveOutputFormat(choice: string, sourceType: string) {
  if (choice && choice !== "auto") return choice;
  if (/png/i.test(sourceType)) return "png";
  if (/webp/i.test(sourceType)) return "webp";
  if (/avif/i.test(sourceType)) return "avif";
  // GIF, BMP, TIFF and HEIC have no browser encoder; JPEG is the safe stand-in,
  // except that transparency needs PNG.
  if (/gif|bmp|tiff|heic|heif|svg|icon/i.test(sourceType)) return "png";
  return "jpeg";
}

export const FORMAT_NAME: Record<string, string> = { jpeg: "JPG", png: "PNG", webp: "WebP", avif: "AVIF", tiff: "TIFF" };

export type Encoded = { blob: Blob; url: string; width: number; height: number; extension: string; format: string };

export async function encodeResult(canvas: HTMLCanvasElement, format: string, quality: number): Promise<Encoded> {
  const { blob, extension } = await encodeCanvas(canvas, format, quality);
  return { blob, url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height, extension, format };
}

/** A small preview-sized PNG of a canvas, for thumbnails that must not hold full-size bitmaps. */
export async function thumbnailUrl(canvas: HTMLCanvasElement, maxSide = 480) {
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  const thumb = createCanvas(canvas.width * scale, canvas.height * scale);
  const ctx = context(thumb);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  return URL.createObjectURL(await canvasToBlob(thumb, "image/png", 100));
}
