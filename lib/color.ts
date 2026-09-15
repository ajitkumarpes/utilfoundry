/**
 * Colour conversion, naming and palette extraction.
 *
 * Pure functions over plain numbers, so both the colour picker and the palette
 * extractor share one implementation and it can be tested without a canvas.
 */

export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };
export type Hsv = { h: number; s: number; v: number };
export type Cmyk = { c: number; m: number; y: number; k: number };

export type ColorFormat = "hex" | "rgb" | "hsl";

const clamp = (value: number, min = 0, max = 255) => Math.min(max, Math.max(min, value));
const byte = (value: number) => clamp(Math.round(value));

/* -------------------------------------------------------------------------- */
/* Conversion                                                                 */
/* -------------------------------------------------------------------------- */

export function toHex({ r, g, b }: Rgb) {
  return `#${[r, g, b].map((channel) => byte(channel).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function fromHex(value: string): Rgb | null {
  const clean = value.trim().replace(/^#/, "");
  const full = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const number = Number.parseInt(full, 16);
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
}

export function toHsl({ r, g, b }: Rgb): Hsl {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l: Math.round(lightness * 100) };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue = max === red
    ? ((green - blue) / delta + (green < blue ? 6 : 0))
    : max === green
      ? (blue - red) / delta + 2
      : (red - green) / delta + 4;

  return { h: Math.round(hue * 60) % 360, s: Math.round(saturation * 100), l: Math.round(lightness * 100) };
}

export function toHsv({ r, g, b }: Rgb): Hsv {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const hue = delta === 0 ? 0
    : max === r ? (((g - b) / delta) % 6) * 60
      : max === g ? (((b - r) / delta) + 2) * 60
        : (((r - g) / delta) + 4) * 60;

  return {
    h: Math.round((hue + 360) % 360),
    s: Math.round(max === 0 ? 0 : (delta / max) * 100),
    v: Math.round((max / 255) * 100)
  };
}

export function toCmyk({ r, g, b }: Rgb): Cmyk {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const k = 1 - Math.max(red, green, blue);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - red - k) / (1 - k)) * 100),
    m: Math.round(((1 - green - k) / (1 - k)) * 100),
    y: Math.round(((1 - blue - k) / (1 - k)) * 100),
    k: Math.round(k * 100)
  };
}

export function fromHsl({ h, s, l }: Hsl): Rgb {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = ((h % 360) + 360) % 360 / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const [red, green, blue] =
    sector < 1 ? [chroma, second, 0]
      : sector < 2 ? [second, chroma, 0]
        : sector < 3 ? [0, chroma, second]
          : sector < 4 ? [0, second, chroma]
            : sector < 5 ? [second, 0, chroma]
              : [chroma, 0, second];
  const match = lightness - chroma / 2;
  return { r: byte((red + match) * 255), g: byte((green + match) * 255), b: byte((blue + match) * 255) };
}

/** Relative luminance per WCAG 2.1, used to choose readable swatch labels. */
export function luminance({ r, g, b }: Rgb) {
  const channel = (value: number) => {
    const normalised = value / 255;
    return normalised <= 0.03928 ? normalised / 12.92 : ((normalised + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb) {
  const first = luminance(a);
  const second = luminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

/** True when black text reads better than white on this colour. */
export function prefersDarkText(color: Rgb) {
  return luminance(color) > 0.35;
}

export function formatColor(color: Rgb, format: ColorFormat) {
  if (format === "rgb") return `rgb(${byte(color.r)}, ${byte(color.g)}, ${byte(color.b)})`;
  if (format === "hsl") {
    const { h, s, l } = toHsl(color);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
  return toHex(color);
}

/* -------------------------------------------------------------------------- */
/* Naming                                                                     */
/* -------------------------------------------------------------------------- */

const HUES: [number, string][] = [
  [10, "Red"], [20, "Vermilion"], [38, "Orange"], [50, "Amber"], [62, "Yellow"],
  [78, "Lime"], [100, "Green"], [150, "Emerald"], [172, "Teal"], [192, "Cyan"],
  [210, "Sky Blue"], [232, "Blue"], [252, "Indigo"], [276, "Violet"], [292, "Purple"],
  [332, "Magenta"], [352, "Pink"], [360, "Red"]
];

/**
 * A descriptive name rather than a lookup into the CSS colour list, which is
 * full of names ("papayawhip") nobody recognises on a swatch.
 */
export function describeColor(color: Rgb) {
  const { h, s, l } = toHsl(color);

  if (s <= 6) {
    if (l >= 96) return "White";
    if (l >= 80) return "Light Grey";
    if (l >= 55) return "Silver";
    if (l >= 32) return "Grey";
    if (l >= 12) return "Charcoal";
    return "Black";
  }

  const family = HUES.find(([limit]) => h < limit)?.[1] ?? "Red";

  if (l >= 90) return `Pale ${family}`;
  if (l <= 12) return `Near-Black ${family}`;
  if (s <= 22) return `Muted ${family}`;
  // A dark colour that still holds its chroma reads as "deep"; one that has
  // lost it reads as "dark". Same lightness, genuinely different colours.
  if (l <= 40) return s >= 55 ? `Deep ${family}` : `Dark ${family}`;
  if (l >= 72) return `Light ${family}`;
  if (s >= 80 && l >= 45 && l <= 60) return `Vivid ${family}`;
  return family;
}

/** Tints, shades and neighbours of one colour, for the "similar colours" row. */
export function relatedColors(color: Rgb, count = 7): Rgb[] {
  const { h, s, l } = toHsl(color);
  const steps = [-30, -20, -10, 0, 12, 24, 36].slice(0, count);
  return steps.map((delta) => fromHsl({
    h: (h + delta / 3 + 360) % 360,
    s: Math.min(100, Math.max(8, s + (delta > 0 ? -delta / 4 : delta / 6))),
    l: Math.min(94, Math.max(8, l + delta))
  }));
}

/* -------------------------------------------------------------------------- */
/* Palette extraction                                                          */
/* -------------------------------------------------------------------------- */

export type Swatch = {
  color: Rgb;
  hex: string;
  name: string;
  /** Share of the sampled pixels this bucket covers, 0–1. */
  share: number;
};

type Bucket = { pixels: Rgb[] };

function channelRange(pixels: Rgb[]) {
  let minR = 255, minG = 255, minB = 255, maxR = 0, maxG = 0, maxB = 0;
  for (const pixel of pixels) {
    if (pixel.r < minR) minR = pixel.r;
    if (pixel.g < minG) minG = pixel.g;
    if (pixel.b < minB) minB = pixel.b;
    if (pixel.r > maxR) maxR = pixel.r;
    if (pixel.g > maxG) maxG = pixel.g;
    if (pixel.b > maxB) maxB = pixel.b;
  }
  // Weighted the way the eye sees them, so a green spread splits before a blue one.
  return [
    { channel: "r" as const, size: (maxR - minR) * 1.0 },
    { channel: "g" as const, size: (maxG - minG) * 1.2 },
    { channel: "b" as const, size: (maxB - minB) * 0.8 }
  ].sort((a, b) => b.size - a.size)[0];
}

function mean(pixels: Rgb[]): Rgb {
  let r = 0, g = 0, b = 0;
  for (const pixel of pixels) { r += pixel.r; g += pixel.g; b += pixel.b; }
  return { r: byte(r / pixels.length), g: byte(g / pixels.length), b: byte(b / pixels.length) };
}

/**
 * Median cut: repeatedly split the bucket with the widest channel spread at its
 * median. Deterministic, which matters — the same image must always produce the
 * same palette.
 */
function medianCut(pixels: Rgb[], count: number): Bucket[] {
  let buckets: Bucket[] = [{ pixels }];

  while (buckets.length < count) {
    const index = buckets
      .map((bucket, at) => ({ at, size: bucket.pixels.length > 1 ? channelRange(bucket.pixels).size : -1 }))
      .sort((a, b) => b.size - a.size)[0];
    if (!index || index.size <= 0) break;

    const target = buckets[index.at];
    const { channel } = channelRange(target.pixels);
    const sorted = [...target.pixels].sort((a, b) => a[channel] - b[channel]);
    const middle = Math.floor(sorted.length / 2);
    buckets = [
      ...buckets.slice(0, index.at),
      { pixels: sorted.slice(0, middle) },
      { pixels: sorted.slice(middle) },
      ...buckets.slice(index.at + 1)
    ].filter((bucket) => bucket.pixels.length > 0);
  }

  return buckets;
}

/** A few Lloyd iterations tighten the median-cut centres onto real clusters. */
function refine(pixels: Rgb[], centres: Rgb[], rounds = 4) {
  let current = centres;
  for (let round = 0; round < rounds; round += 1) {
    const groups: Rgb[][] = current.map(() => []);
    for (const pixel of pixels) {
      let best = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < current.length; i += 1) {
        const centre = current[i];
        const distance = (pixel.r - centre.r) ** 2 + (pixel.g - centre.g) ** 2 * 1.4 + (pixel.b - centre.b) ** 2 * 0.8;
        if (distance < bestDistance) { bestDistance = distance; best = i; }
      }
      groups[best].push(pixel);
    }
    const next = groups.map((group, index) => (group.length ? mean(group) : current[index]));
    const settled = next.every((centre, index) =>
      centre.r === current[index].r && centre.g === current[index].g && centre.b === current[index].b);
    current = next;
    if (settled) return { centres: current, groups };
  }

  const groups: Rgb[][] = current.map(() => []);
  for (const pixel of pixels) {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < current.length; i += 1) {
      const centre = current[i];
      const distance = (pixel.r - centre.r) ** 2 + (pixel.g - centre.g) ** 2 * 1.4 + (pixel.b - centre.b) ** 2 * 0.8;
      if (distance < bestDistance) { bestDistance = distance; best = i; }
    }
    groups[best].push(pixel);
  }
  return { centres: current, groups };
}

/** Samples at most `limit` opaque pixels, evenly spread across the image. */
export function samplePixels(data: Uint8ClampedArray, limit = 20_000): Rgb[] {
  const total = data.length / 4;
  const stride = Math.max(1, Math.floor(total / limit));
  const pixels: Rgb[] = [];
  for (let index = 0; index < total; index += stride) {
    const at = index * 4;
    if (data[at + 3] < 125) continue;
    pixels.push({ r: data[at], g: data[at + 1], b: data[at + 2] });
  }
  return pixels;
}

/**
 * Extracts `count` dominant colours. Near-duplicates are merged and the result
 * is ordered by how much of the image each one covers.
 */
export function extractPalette(pixels: Rgb[], count: number): Swatch[] {
  if (!pixels.length) return [];

  const wanted = Math.max(1, Math.min(24, count));
  const buckets = medianCut(pixels, wanted);
  const { centres, groups } = refine(pixels, buckets.map((bucket) => mean(bucket.pixels)));

  const swatches = centres
    .map((color, index) => ({ color, share: groups[index].length / pixels.length }))
    .filter((entry) => entry.share > 0)
    .sort((a, b) => b.share - a.share);

  // Two swatches a person cannot tell apart are one swatch.
  const kept: typeof swatches = [];
  for (const swatch of swatches) {
    const duplicate = kept.find((existing) =>
      Math.abs(existing.color.r - swatch.color.r) < 10 &&
      Math.abs(existing.color.g - swatch.color.g) < 10 &&
      Math.abs(existing.color.b - swatch.color.b) < 10);
    if (duplicate) duplicate.share += swatch.share;
    else kept.push({ ...swatch });
  }

  return kept.slice(0, wanted).map((entry) => ({
    color: entry.color,
    hex: toHex(entry.color),
    name: describeColor(entry.color),
    share: Math.round(entry.share * 1000) / 1000
  }));
}

export function paletteToJson(swatches: Swatch[]) {
  return JSON.stringify({
    generator: "UtilFoundry Images — Color Palette Extractor",
    colors: swatches.map((swatch) => ({
      hex: swatch.hex,
      rgb: formatColor(swatch.color, "rgb"),
      hsl: formatColor(swatch.color, "hsl"),
      name: swatch.name,
      share: swatch.share
    }))
  }, null, 2);
}

export function paletteToText(swatches: Swatch[], format: ColorFormat) {
  return swatches.map((swatch) => formatColor(swatch.color, format)).join("\n");
}
