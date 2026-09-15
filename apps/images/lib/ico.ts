/**
 * ICO encoder.
 *
 * Windows has read PNG-compressed icon entries since Vista, but plenty of older
 * software still expects a BMP DIB, so the small sizes are written as 32-bit
 * DIBs and only 256×256 uses PNG — which is what icon toolchains settled on.
 */

export type IconSource = { size: number; pixels: Uint8ClampedArray; png: Uint8Array };

const PNG_FROM = 256;

/**
 * Builds the BITMAPINFOHEADER DIB an ICO entry expects: bottom-up BGRA rows,
 * a doubled height in the header, then a 1-bit AND mask.
 */
function bmpEntry(size: number, pixels: Uint8ClampedArray) {
  const maskStride = Math.ceil(size / 32) * 4;
  const header = 40;
  const colorSize = size * size * 4;
  const maskSize = maskStride * size;
  const out = new Uint8Array(header + colorSize + maskSize);
  const view = new DataView(out.buffer);

  view.setUint32(0, header, true);
  view.setInt32(4, size, true);
  // The height covers the colour rows and the mask rows together.
  view.setInt32(8, size * 2, true);
  view.setUint16(12, 1, true); // planes
  view.setUint16(14, 32, true); // bits per pixel
  view.setUint32(16, 0, true); // BI_RGB
  view.setUint32(20, colorSize + maskSize, true);

  for (let y = 0; y < size; y += 1) {
    // DIB rows run bottom-to-top.
    const sourceRow = (size - 1 - y) * size * 4;
    const targetRow = header + y * size * 4;
    for (let x = 0; x < size; x += 1) {
      const from = sourceRow + x * 4;
      const to = targetRow + x * 4;
      out[to] = pixels[from + 2];
      out[to + 1] = pixels[from + 1];
      out[to + 2] = pixels[from];
      out[to + 3] = pixels[from + 3];

      // A fully transparent pixel sets its mask bit, for renderers that use it.
      if (pixels[from + 3] === 0) {
        const maskAt = header + colorSize + y * maskStride + (x >> 3);
        out[maskAt] |= 0x80 >> (x & 7);
      }
    }
  }

  return out;
}

/** Packs the given renditions into a single multi-resolution .ico file. */
export function createIco(sources: IconSource[]): Blob {
  const usable = sources
    .filter((source) => source.size >= 1 && source.size <= 256)
    .sort((a, b) => a.size - b.size);
  if (!usable.length) throw new Error("An icon needs at least one size.");

  const images = usable.map((source) =>
    source.size >= PNG_FROM ? source.png : bmpEntry(source.size, source.pixels));

  const directory = new Uint8Array(6 + usable.length * 16);
  const view = new DataView(directory.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, usable.length, true);

  let offset = directory.length;
  usable.forEach((source, index) => {
    const at = 6 + index * 16;
    // 256 is stored as 0, since the field is a single byte.
    directory[at] = source.size === 256 ? 0 : source.size;
    directory[at + 1] = source.size === 256 ? 0 : source.size;
    directory[at + 2] = 0; // palette entries
    directory[at + 3] = 0; // reserved
    view.setUint16(at + 4, 1, true); // colour planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, images[index].length, true);
    view.setUint32(at + 12, offset, true);
    offset += images[index].length;
  });

  return new Blob([directory, ...images] as BlobPart[], { type: "image/x-icon" });
}

export type ManifestOptions = { name: string; shortName: string; themeColor: string; backgroundColor: string };

/** The web app manifest that pairs with the generated PNG set. */
export function webManifest({ name, shortName, themeColor, backgroundColor }: ManifestOptions) {
  return JSON.stringify({
    name,
    short_name: shortName,
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ],
    theme_color: themeColor,
    background_color: backgroundColor,
    display: "standalone",
    start_url: "/"
  }, null, 2);
}

/** The markup a developer has to paste for the generated set to be picked up. */
export function headSnippet() {
  return [
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">'
  ].join("\n");
}
