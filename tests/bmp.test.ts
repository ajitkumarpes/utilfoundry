import { describe, expect, it } from "vitest";
import { encodeBmp } from "@/lib/bmp";

/** RGBA pixels for a small image, filled by a function of (x, y). */
function pixels(width: number, height: number, at: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.set(at(x, y), (y * width + x) * 4);
  }
  return data;
}

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

describe("encodeBmp", () => {
  it("writes an opaque image as 24-bit BI_RGB with padded, bottom-up rows", () => {
    // 3 px × 3 bytes = 9 bytes per row, padded to 12.
    const bmp = encodeBmp(pixels(3, 2, (x, y) => [x * 10, y * 100, 7, 255]), 3, 2);
    const header = view(bmp);
    expect(String.fromCharCode(bmp[0], bmp[1])).toBe("BM");
    expect(header.getUint32(2, true)).toBe(bmp.length);
    expect(header.getUint32(10, true)).toBe(54);
    expect(header.getUint16(28, true)).toBe(24);
    expect(header.getUint32(30, true)).toBe(0);
    expect(bmp.length).toBe(54 + 12 * 2);
    // The first stored row is the bottom one (y = 1), in BGR order.
    expect([...bmp.subarray(54, 57)]).toEqual([7, 100, 0]);
    expect([...bmp.subarray(57, 60)]).toEqual([7, 100, 10]);
    // Then the top row (y = 0), after the 3 padding bytes.
    expect([...bmp.subarray(66, 69)]).toEqual([7, 0, 0]);
  });

  it("keeps transparency with a 32-bit V4 header and channel masks", () => {
    const bmp = encodeBmp(pixels(2, 2, (x, y) => [255, 0, 0, x === 0 && y === 0 ? 0 : 200]), 2, 2);
    const header = view(bmp);
    expect(header.getUint32(14, true)).toBe(108);
    expect(header.getUint16(28, true)).toBe(32);
    expect(header.getUint32(30, true)).toBe(3);
    expect(header.getUint32(66, true)).toBe(0xff000000);
    const offset = header.getUint32(10, true);
    expect(offset).toBe(122);
    // Top-left pixel (fully transparent) is stored in the last row.
    expect([...bmp.subarray(offset + 8, offset + 12)]).toEqual([0, 0, 255, 0]);
    expect([...bmp.subarray(offset, offset + 4)]).toEqual([0, 0, 255, 200]);
  });

  it("rejects a buffer that does not match the size", () => {
    expect(() => encodeBmp(new Uint8ClampedArray(12), 2, 2)).toThrow();
  });
});
