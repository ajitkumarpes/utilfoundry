/**
 * Pixel operations used by the live previews and by the final export.
 * Everything here runs on a 2D canvas in the browser; nothing is uploaded.
 */

export function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function context(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Your browser blocked 2D canvas access, so images cannot be processed here.");
  return ctx;
}

/** roundRect is not available everywhere yet, so corners are drawn explicitly. */
export function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, width: number, height: number,
  radii: [number, number, number, number]
) {
  const max = Math.min(width, height) / 2;
  const [tl, tr, br, bl] = radii.map((value) => Math.max(0, Math.min(value, max))) as [number, number, number, number];
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + width - tr, y);
  ctx.arcTo(x + width, y, x + width, y + tr, tr);
  ctx.lineTo(x + width, y + height - br);
  ctx.arcTo(x + width, y + height, x + width - br, y + height, br);
  ctx.lineTo(x + bl, y + height);
  ctx.arcTo(x, y + height, x, y + height - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

/**
 * Gaussian blur via the native canvas filter. The source is drawn oversized so the
 * soft transparent edge the filter produces falls outside the visible canvas.
 */
export function gaussianBlur(source: CanvasImageSource, width: number, height: number, radius: number) {
  const canvas = createCanvas(width, height);
  const ctx = context(canvas);
  if (radius <= 0) {
    ctx.drawImage(source, 0, 0, width, height);
    return canvas;
  }
  ctx.filter = `blur(${radius}px)`;
  const bleed = Math.ceil(radius * 2);
  ctx.drawImage(source, -bleed, -bleed, width + bleed * 2, height + bleed * 2);
  ctx.filter = "none";
  return canvas;
}

/** Separable box blur — a genuinely different look from the gaussian path. */
export function boxBlur(data: ImageData, radius: number) {
  const r = Math.max(1, Math.round(radius));
  const { width, height } = data;
  const pixels = data.data;
  const pass = (horizontal: boolean) => {
    const outer = horizontal ? height : width;
    const inner = horizontal ? width : height;
    const stride = horizontal ? 4 : width * 4;
    const jump = horizontal ? width * 4 : 4;
    const line = new Uint8ClampedArray(inner * 4);
    for (let o = 0; o < outer; o += 1) {
      const base = o * jump;
      for (let i = 0; i < inner; i += 1) {
        for (let c = 0; c < 4; c += 1) line[i * 4 + c] = pixels[base + i * stride + c];
      }
      let sr = 0, sg = 0, sb = 0, sa = 0, count = 0;
      for (let i = -r; i <= r; i += 1) {
        const index = Math.min(inner - 1, Math.max(0, i)) * 4;
        sr += line[index]; sg += line[index + 1]; sb += line[index + 2]; sa += line[index + 3];
        count += 1;
      }
      for (let i = 0; i < inner; i += 1) {
        const target = base + i * stride;
        pixels[target] = sr / count;
        pixels[target + 1] = sg / count;
        pixels[target + 2] = sb / count;
        pixels[target + 3] = sa / count;
        const addIndex = Math.min(inner - 1, i + r + 1) * 4;
        const dropIndex = Math.max(0, i - r) * 4;
        sr += line[addIndex] - line[dropIndex];
        sg += line[addIndex + 1] - line[dropIndex + 1];
        sb += line[addIndex + 2] - line[dropIndex + 2];
        sa += line[addIndex + 3] - line[dropIndex + 3];
      }
    }
  };
  pass(true);
  pass(false);
  return data;
}

/** Directional smear, sampled along a 45° axis like a camera pan. */
export function motionBlur(source: CanvasImageSource, width: number, height: number, distance: number) {
  const canvas = createCanvas(width, height);
  const ctx = context(canvas);
  const steps = Math.max(2, Math.min(40, Math.round(distance)));
  ctx.globalAlpha = 1 / steps;
  for (let i = 0; i < steps; i += 1) {
    const offset = (i - steps / 2) * (distance / steps);
    ctx.drawImage(source, offset, 0, width, height);
  }
  ctx.globalAlpha = 1;
  return canvas;
}

/** Sharp centre fading into a blurred ring, the way a wide aperture renders. */
export function lensBlur(source: CanvasImageSource, width: number, height: number, radius: number) {
  const blurred = gaussianBlur(source, width, height, radius);
  const canvas = createCanvas(width, height);
  const ctx = context(canvas);
  ctx.drawImage(blurred, 0, 0);

  const mask = createCanvas(width, height);
  const maskCtx = context(mask);
  maskCtx.drawImage(source, 0, 0, width, height);
  const gradient = maskCtx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.1,
    width / 2, height / 2, Math.min(width, height) * 0.55
  );
  gradient.addColorStop(0, "rgba(0,0,0,1)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  maskCtx.globalCompositeOperation = "destination-in";
  maskCtx.fillStyle = gradient;
  maskCtx.fillRect(0, 0, width, height);
  maskCtx.globalCompositeOperation = "source-over";

  ctx.drawImage(mask, 0, 0);
  return canvas;
}

/**
 * Unsharp mask. `amount` is 0–1; `preserveColors` applies the correction to
 * luminance only so saturated edges do not pick up colour fringes.
 */
export function unsharpMask(
  base: ImageData,
  blurredSource: ImageData,
  amount: number,
  preserveColors: boolean
) {
  const output = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
  const a = output.data;
  const b = blurredSource.data;
  for (let i = 0; i < a.length; i += 4) {
    if (preserveColors) {
      const lumBase = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
      const lumBlur = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2];
      const delta = (lumBase - lumBlur) * amount;
      a[i] = a[i] + delta;
      a[i + 1] = a[i + 1] + delta;
      a[i + 2] = a[i + 2] + delta;
    } else {
      a[i] = a[i] + (a[i] - b[i]) * amount;
      a[i + 1] = a[i + 1] + (a[i + 1] - b[i + 1]) * amount;
      a[i + 2] = a[i + 2] + (a[i + 2] - b[i + 2]) * amount;
    }
  }
  return output;
}

export type GrayscaleMode = "desaturate" | "luminosity" | "average";

export function grayscale(data: ImageData, mode: GrayscaleMode, brightness: number, contrast: number) {
  const pixels = data.data;
  // Standard contrast curve: -100 flattens to mid grey, +100 roughly doubles slope.
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    let value: number;
    if (mode === "luminosity") value = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    else if (mode === "average") value = (r + g + b) / 3;
    else value = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    value = factor * (value - 128) + 128 + brightness;
    pixels[i] = value;
    pixels[i + 1] = value;
    pixels[i + 2] = value;
  }
  return data;
}

export type CornerSelection = "all" | "top" | "bottom" | "custom";

export function cornerRadii(selection: CornerSelection, radius: number, custom?: [number, number, number, number]) {
  if (selection === "custom" && custom) return custom;
  if (selection === "top") return [radius, radius, 0, 0] as [number, number, number, number];
  if (selection === "bottom") return [0, 0, radius, radius] as [number, number, number, number];
  return [radius, radius, radius, radius] as [number, number, number, number];
}

export type BorderStyle = "solid" | "dashed" | "dotted" | "double";

export function strokeBorder(
  ctx: CanvasRenderingContext2D,
  style: BorderStyle,
  color: string,
  thickness: number,
  draw: (inset: number, lineWidth: number) => void
) {
  ctx.strokeStyle = color;
  ctx.lineJoin = "miter";
  if (style === "double") {
    const unit = Math.max(1, thickness / 3);
    ctx.setLineDash([]);
    ctx.lineWidth = unit;
    draw(unit / 2, unit);
    draw(thickness - unit / 2, unit);
    return;
  }
  ctx.lineWidth = thickness;
  if (style === "dashed") ctx.setLineDash([thickness * 2.2, thickness * 1.4]);
  else if (style === "dotted") { ctx.lineCap = "round"; ctx.setLineDash([0.1, thickness * 1.9]); }
  else ctx.setLineDash([]);
  draw(thickness / 2, thickness);
  ctx.setLineDash([]);
  ctx.lineCap = "butt";
}

export function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean.padEnd(6, "0");
  const value = Number.parseInt(full.slice(0, 6), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
