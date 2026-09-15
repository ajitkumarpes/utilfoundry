/**
 * BMP encoder for the converter.
 *
 * Opaque images are written as classic 24-bit BI_RGB files, which every reader
 * accepts. Images with transparency use a 32-bit BITMAPV4HEADER with explicit
 * channel masks: the variant that keeps alpha in Windows, macOS and browsers.
 */

const FILE_HEADER = 14;
const INFO_HEADER = 40;
const V4_HEADER = 108;
/** 72 dpi, expressed the way BMP wants it: pixels per metre. */
const PIXELS_PER_METRE = 2835;

/** Encodes RGBA pixels (as from `getImageData`) into a .bmp file. */
export function encodeBmp(pixels: Uint8ClampedArray | Uint8Array, width: number, height: number): Uint8Array {
  if (pixels.length !== width * height * 4) throw new Error("The pixel buffer does not match the image size.");

  let opaque = true;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] !== 255) { opaque = false; break; }
  }

  const header = opaque ? INFO_HEADER : V4_HEADER;
  const bytesPerPixel = opaque ? 3 : 4;
  // Every row is padded to a multiple of four bytes.
  const stride = Math.ceil((width * bytesPerPixel) / 4) * 4;
  const offset = FILE_HEADER + header;
  const out = new Uint8Array(offset + stride * height);
  const view = new DataView(out.buffer);

  out[0] = 0x42; // "B"
  out[1] = 0x4d; // "M"
  view.setUint32(2, out.length, true);
  view.setUint32(10, offset, true);

  view.setUint32(14, header, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive height: rows run bottom-up
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, bytesPerPixel * 8, true);
  view.setUint32(30, opaque ? 0 : 3, true); // BI_RGB or BI_BITFIELDS
  view.setUint32(34, stride * height, true);
  view.setInt32(38, PIXELS_PER_METRE, true);
  view.setInt32(42, PIXELS_PER_METRE, true);

  if (!opaque) {
    view.setUint32(54, 0x00ff0000, true); // red
    view.setUint32(58, 0x0000ff00, true); // green
    view.setUint32(62, 0x000000ff, true); // blue
    view.setUint32(66, 0xff000000, true); // alpha
    view.setUint32(70, 0x73524742, true); // LCS_sRGB
  }

  for (let y = 0; y < height; y += 1) {
    const source = (height - 1 - y) * width * 4;
    let target = offset + y * stride;
    for (let x = 0; x < width; x += 1) {
      const from = source + x * 4;
      out[target] = pixels[from + 2];
      out[target + 1] = pixels[from + 1];
      out[target + 2] = pixels[from];
      if (!opaque) out[target + 3] = pixels[from + 3];
      target += bytesPerPixel;
    }
  }

  return out;
}
