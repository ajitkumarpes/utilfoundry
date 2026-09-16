import { describe, expect, it } from "vitest";
import {
  contrastRatio, describeColor, extractPalette, formatColor, fromHex, fromHsl,
  paletteToJson, prefersDarkText, relatedColors, samplePixels, toCmyk, toHex, toHsl, toHsv, type Rgb
} from "@/lib/color";
import { compareImages, comparisonSize, summarise, toleranceFor } from "@/lib/diff";
import { createIco } from "@/lib/ico";
import { crc32, createZip, sequenceName } from "@/lib/zip";
import { fitRect, layoutCollage, layoutContactSheet } from "@/lib/compose";
import type { SourceImage, ToolOptions } from "@/lib/canvas/types";

/* -------------------------------------------------------------------------- */

describe("colour conversion", () => {
  it("round-trips hex and RGB", () => {
    expect(toHex({ r: 240, g: 78, b: 35 })).toBe("#F04E23");
    expect(fromHex("#f04e23")).toEqual({ r: 240, g: 78, b: 35 });
    expect(fromHex("f04")).toEqual({ r: 255, g: 0, b: 68 });
    expect(fromHex("nope")).toBeNull();
  });

  it("matches the reference values for a mid teal", () => {
    const teal = { r: 14, g: 116, b: 144 };
    expect(toHsl(teal)).toEqual({ h: 193, s: 82, l: 31 });
    expect(toHsv(teal)).toEqual({ h: 193, s: 90, v: 56 });
    expect(toCmyk(teal)).toEqual({ c: 90, m: 19, y: 0, k: 44 });
  });

  it("survives a hue round trip", () => {
    for (const hex of ["#F04E23", "#16A34A", "#2F6FED", "#7C4DEE", "#111C3D"]) {
      const rgb = fromHex(hex)!;
      const back = fromHsl(toHsl(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(3);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(3);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(3);
    }
  });

  it("handles the achromatic edges", () => {
    expect(toHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 });
    expect(toCmyk({ r: 0, g: 0, b: 0 })).toEqual({ c: 0, m: 0, y: 0, k: 100 });
    expect(toHsv({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, v: 100 });
  });

  it("formats each notation the way CSS expects", () => {
    const color = { r: 14, g: 116, b: 144 };
    expect(formatColor(color, "hex")).toBe("#0E7490");
    expect(formatColor(color, "rgb")).toBe("rgb(14, 116, 144)");
    expect(formatColor(color, "hsl")).toBe("hsl(193, 82%, 31%)");
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })).toBe(21);
    expect(prefersDarkText({ r: 255, g: 255, b: 255 })).toBe(true);
    expect(prefersDarkText({ r: 17, g: 28, b: 61 })).toBe(false);
  });
});

describe("colour naming", () => {
  it("names greys without inventing a hue", () => {
    expect(describeColor({ r: 255, g: 255, b: 255 })).toBe("White");
    expect(describeColor({ r: 0, g: 0, b: 0 })).toBe("Black");
    expect(describeColor({ r: 128, g: 128, b: 128 })).toBe("Grey");
  });

  it("describes hue, lightness and saturation together", () => {
    expect(describeColor({ r: 14, g: 116, b: 144 })).toBe("Deep Sky Blue");
    expect(describeColor({ r: 240, g: 78, b: 35 })).toContain("Vermilion");
    expect(describeColor({ r: 250, g: 220, b: 225 })).toBe("Pale Pink");
  });

  it("offers related colours without leaving the legal range", () => {
    const related = relatedColors({ r: 14, g: 116, b: 144 });
    expect(related).toHaveLength(7);
    for (const color of related) {
      for (const channel of [color.r, color.g, color.b]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe("palette extraction", () => {
  /** Four flat quadrants: the palette should find exactly those four colours. */
  function quadrants(): Uint8ClampedArray {
    const size = 64;
    const data = new Uint8ClampedArray(size * size * 4);
    const colors: Rgb[] = [
      { r: 240, g: 78, b: 35 }, { r: 22, g: 163, b: 74 },
      { r: 47, g: 111, b: 237 }, { r: 250, g: 250, b: 250 }
    ];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const color = colors[(y < size / 2 ? 0 : 2) + (x < size / 2 ? 0 : 1)];
        const at = (y * size + x) * 4;
        data[at] = color.r; data[at + 1] = color.g; data[at + 2] = color.b; data[at + 3] = 255;
      }
    }
    return data;
  }

  it("recovers flat regions exactly", () => {
    const palette = extractPalette(samplePixels(quadrants()), 4);
    expect(palette).toHaveLength(4);
    expect(palette.map((swatch) => swatch.hex).sort())
      .toEqual(["#16A34A", "#2F6FED", "#F04E23", "#FAFAFA"]);
  });

  it("orders by coverage and the shares add up", () => {
    const palette = extractPalette(samplePixels(quadrants()), 4);
    for (let index = 1; index < palette.length; index += 1) {
      expect(palette[index - 1].share).toBeGreaterThanOrEqual(palette[index].share);
    }
    const total = palette.reduce((sum, swatch) => sum + swatch.share, 0);
    expect(total).toBeGreaterThan(0.97);
    expect(total).toBeLessThan(1.03);
  });

  it("is deterministic", () => {
    const pixels = samplePixels(quadrants());
    expect(extractPalette(pixels, 6)).toEqual(extractPalette(pixels, 6));
  });

  it("skips transparent pixels and copes with an empty image", () => {
    const data = new Uint8ClampedArray(16 * 4);
    expect(samplePixels(data)).toHaveLength(0);
    expect(extractPalette([], 5)).toEqual([]);
  });

  it("never returns more swatches than there are colours", () => {
    const palette = extractPalette(samplePixels(quadrants()), 12);
    expect(palette.length).toBeLessThanOrEqual(4);
  });

  it("exports JSON with every notation", () => {
    const json = JSON.parse(paletteToJson(extractPalette(samplePixels(quadrants()), 2)));
    expect(json.colors[0]).toHaveProperty("hex");
    expect(json.colors[0]).toHaveProperty("rgb");
    expect(json.colors[0]).toHaveProperty("hsl");
  });
});

/* -------------------------------------------------------------------------- */

describe("image comparison", () => {
  function solid(width: number, height: number, color: Rgb) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let at = 0; at < data.length; at += 4) {
      data[at] = color.r; data[at + 1] = color.g; data[at + 2] = color.b; data[at + 3] = 255;
    }
    return data;
  }

  it("reports identical images as identical", () => {
    const a = solid(10, 10, { r: 100, g: 100, b: 100 });
    const result = compareImages(a, a.slice(), 10, 10, 75);
    expect(result.changed).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.bounds).toBeNull();
    expect(summarise(result)).toContain("pixel-identical");
  });

  it("finds a changed block and boxes it", () => {
    const a = solid(10, 10, { r: 0, g: 0, b: 0 });
    const b = a.slice();
    for (let y = 2; y < 5; y += 1) {
      for (let x = 3; x < 7; x += 1) {
        const at = (y * 10 + x) * 4;
        b[at] = 255; b[at + 1] = 255; b[at + 2] = 255;
      }
    }
    const result = compareImages(a, b, 10, 10, 75);
    expect(result.changed).toBe(12);
    expect(result.bounds).toEqual({ x: 3, y: 2, width: 4, height: 3 });
    expect(result.percentage).toBe(12);
  });

  it("paints changes red and everything else dim grey", () => {
    const a = solid(2, 1, { r: 0, g: 0, b: 0 });
    const b = solid(2, 1, { r: 0, g: 0, b: 0 });
    b[4] = 255; b[5] = 255; b[6] = 255;
    const { pixels } = compareImages(a, b, 2, 1, 75);
    expect([pixels[0], pixels[1], pixels[2]]).toEqual([0, 0, 0]);
    expect([pixels[4], pixels[5], pixels[6]]).toEqual([255, 45, 45]);
  });

  it("makes higher sensitivity notice smaller differences", () => {
    expect(toleranceFor(0)).toBeGreaterThan(toleranceFor(100));
    const a = solid(8, 8, { r: 100, g: 100, b: 100 });
    const b = solid(8, 8, { r: 108, g: 108, b: 108 });
    expect(compareImages(a, b, 8, 8, 10).changed).toBe(0);
    expect(compareImages(a, b, 8, 8, 100).changed).toBe(64);
  });

  it("refuses mismatched buffers", () => {
    expect(() => compareImages(new Uint8ClampedArray(16), new Uint8ClampedArray(32), 2, 2, 50)).toThrow();
  });

  it("compares in the first image's frame and flags a rescale", () => {
    expect(comparisonSize({ width: 800, height: 600 }, { width: 800, height: 600 }))
      .toEqual({ width: 800, height: 600, rescaled: false });
    expect(comparisonSize({ width: 3200, height: 2400 }, { width: 800, height: 600 }))
      .toEqual({ width: 1600, height: 1200, rescaled: true });
  });
});

/* -------------------------------------------------------------------------- */

describe("zip writer", () => {
  it("matches the reference CRC-32 of a known string", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it("writes the local header, central directory and end record", async () => {
    const blob = createZip([{ name: "a.txt", data: new TextEncoder().encode("hello") }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(blob.type).toBe("application/zip");

    const endAt = bytes.length - 22;
    expect(view.getUint32(endAt, true)).toBe(0x06054b50);
    expect(view.getUint16(endAt + 10, true)).toBe(1);
  });

  it("records every entry in the end record", async () => {
    const entries = ["a", "b", "c"].map((name) => ({ name: `${name}.bin`, data: new Uint8Array([1, 2, 3]) }));
    const bytes = new Uint8Array(await createZip(entries).arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(view.getUint16(bytes.length - 22 + 10, true)).toBe(3);
  });

  it("refuses an empty archive", () => {
    expect(() => createZip([])).toThrow();
  });

  it("pads member names so they sort", () => {
    expect(sequenceName("frame", 0, 120, "png")).toBe("frame_001.png");
    expect(sequenceName("frame", 99, 1200, "png")).toBe("frame_0100.png");
  });
});

describe("ico writer", () => {
  const source = (size: number) => ({
    size,
    pixels: new Uint8ClampedArray(size * size * 4).fill(200),
    png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4])
  });

  it("writes one directory entry per size, smallest first", async () => {
    const bytes = new Uint8Array(await createIco([source(32), source(16)]).arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(view.getUint16(2, true)).toBe(1); // type: icon
    expect(view.getUint16(4, true)).toBe(2);
    expect(bytes[6]).toBe(16);
    expect(bytes[6 + 16]).toBe(32);
  });

  it("stores 256 px as zero, the way the format requires", async () => {
    const bytes = new Uint8Array(await createIco([source(256)]).arrayBuffer());
    expect(bytes[6]).toBe(0);
    expect(bytes[7]).toBe(0);
  });

  it("points each entry at real data inside the file", async () => {
    const blob = createIco([source(16), source(32)]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    for (let index = 0; index < 2; index += 1) {
      const at = 6 + index * 16;
      const size = view.getUint32(at + 8, true);
      const offset = view.getUint32(at + 12, true);
      expect(offset).toBeGreaterThanOrEqual(6 + 2 * 16);
      expect(offset + size).toBeLessThanOrEqual(bytes.length);
    }
  });

  it("refuses to build an icon with no sizes", () => {
    expect(() => createIco([])).toThrow();
  });

  it("round-trips real pixels through the BMP entry", async () => {
    // A 2 x 2 icon: red, green / blue, transparent — enough to catch the
    // BGRA channel order, the bottom-up row order and the AND mask together.
    const size = 2;
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 0, 0, 0, 0
    ]);
    const bytes = new Uint8Array(await createIco([
      { size, pixels, png: new Uint8Array([0x89, 0x50]) }
    ]).arrayBuffer());
    const view = new DataView(bytes.buffer);

    const offset = view.getUint32(6 + 12, true);
    expect(view.getUint32(offset, true)).toBe(40); // BITMAPINFOHEADER
    expect(view.getInt32(offset + 4, true)).toBe(size);
    expect(view.getInt32(offset + 8, true)).toBe(size * 2); // colour + mask rows
    expect(view.getUint16(offset + 14, true)).toBe(32);

    // Rows are bottom-up, so the first stored row is the source's last row.
    const colour = offset + 40;
    expect([...bytes.slice(colour, colour + 8)]).toEqual([255, 0, 0, 255, 0, 0, 0, 0]);
    expect([...bytes.slice(colour + 8, colour + 16)]).toEqual([0, 0, 255, 255, 0, 255, 0, 255]);

    // The single transparent pixel sets its AND-mask bit, and nothing else does.
    const mask = colour + size * size * 4;
    expect(bytes[mask]).toBe(0b01000000);
    expect(bytes[mask + 4]).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */

describe("composition layout", () => {
  const image = (name: string, width: number, height: number) =>
    ({ id: name, name, size: 1000, type: "image/jpeg", url: "", width, height, element: {} } as unknown as SourceImage);
  const four = [image("a.jpg", 1600, 1200), image("b.jpg", 1600, 1200), image("c.jpg", 1600, 1200), image("d.jpg", 1600, 1200)];
  const options = (extra: ToolOptions = {}) => ({ sheetWidth: "1600", spacing: 10, columns: 4, ...extra });

  it("lays a contact sheet out in the requested columns", () => {
    const sheet = layoutContactSheet(four, options());
    expect(sheet.columns).toBe(4);
    expect(sheet.rows).toBe(1);
    expect(sheet.width).toBe(1600);
    expect(sheet.cells).toHaveLength(4);
  });

  it("wraps onto further rows", () => {
    const sheet = layoutContactSheet(four, options({ columns: 2 }));
    expect(sheet.rows).toBe(2);
    expect(sheet.cells[2].y).toBeGreaterThan(sheet.cells[0].y);
    expect(sheet.cells[2].x).toBe(sheet.cells[0].x);
  });

  it("keeps cells inside the sheet and never overlapping", () => {
    const sheet = layoutContactSheet(four, options({ columns: 3, spacing: 24 }));
    for (const cell of sheet.cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.x + cell.width).toBeLessThanOrEqual(sheet.width);
      expect(cell.y + cell.height + cell.labelHeight).toBeLessThanOrEqual(sheet.height);
    }
    expect(sheet.cells[0].x + sheet.cells[0].width).toBeLessThanOrEqual(sheet.cells[1].x);
  });

  it("reserves caption room only when captions are on", () => {
    expect(layoutContactSheet(four, options({ showFilenames: false })).cells[0].labelHeight).toBe(0);
    expect(layoutContactSheet(four, options({ showFilenames: true, fontSize: 20 })).cells[0].labelHeight).toBe(38);
    expect(layoutContactSheet(four, options({ showFilenames: true, labelPosition: "overlay" })).cells[0].labelHeight).toBe(0);
  });

  it("refuses a grid too dense to be readable", () => {
    const twelve = Array.from({ length: 12 }, (_, index) => image(`${index}.jpg`, 1600, 1200));
    expect(() => layoutContactSheet(twelve, options({ columns: 12, spacing: 200 }))).toThrow(/too small/);
  });

  it("uses no more columns than there are images", () => {
    const sheet = layoutContactSheet(four.slice(0, 3), options({ columns: 4 }));
    expect(sheet.columns).toBe(3);
    const last = sheet.cells[2];
    // The three cells span the sheet instead of leaving an empty fourth column.
    expect(sheet.width - (last.x + last.width)).toBeLessThanOrEqual(10 + 2);
  });

  it("returns an empty sheet for no images", () => {
    expect(layoutContactSheet([], options()).cells).toHaveLength(0);
  });

  it("lays a horizontal collage out in one row", () => {
    const strip = layoutCollage(four, { layout: "horizontal", gap: 12, sheetWidth: "1600" });
    expect(strip.rows).toBe(1);
    const heights = new Set(strip.cells.map((cell) => cell.height));
    expect(heights.size).toBe(1);
    // Rounding each width on its own used to leave the sheet a pixel or two short.
    expect(strip.width).toBe(1600);
  });

  it("lays a vertical collage out in one column", () => {
    const stack = layoutCollage(four, { layout: "vertical", gap: 12, sheetWidth: "1600" });
    expect(stack.columns).toBe(1);
    expect(new Set(stack.cells.map((cell) => cell.width)).size).toBe(1);
  });

  it("gives the mosaic hero more room than the rest", () => {
    const collage = layoutCollage(four, { layout: "mosaic", gap: 12, sheetWidth: "1600" });
    const [hero, ...rest] = collage.cells;
    for (const cell of rest) expect(hero.width * hero.height).toBeGreaterThan(cell.width * cell.height);
  });

  it("stretches a part-filled last grid row instead of leaving a blank cell", () => {
    const three = layoutCollage(four.slice(0, 3), { layout: "grid", gap: 12, sheetWidth: "1600" });
    expect([three.columns, three.rows]).toEqual([2, 2]);
    const [first, second, last] = three.cells;
    expect(last.x).toBe(first.x);
    expect(last.x + last.width).toBeGreaterThanOrEqual(second.x + second.width - 2);
  });

  it("falls back to a grid when a mosaic has too few images", () => {
    const pair = layoutCollage(four.slice(0, 2), { layout: "mosaic", gap: 12, sheetWidth: "1600" });
    expect(pair.cells).toHaveLength(2);
    expect(pair.cells[0].width).toBe(pair.cells[1].width);
  });
});

describe("fit", () => {
  const image = { width: 200, height: 100 };

  it("letterboxes when fitting", () => {
    const box = fitRect(image, 100, 100, "fit");
    expect(box.dw).toBe(100);
    expect(box.dh).toBe(50);
    expect(box.dy).toBe(25);
    expect(box.sw).toBe(200);
  });

  it("crops the source when filling", () => {
    const box = fitRect(image, 100, 100, "fill");
    expect(box.dw).toBe(100);
    expect(box.dh).toBe(100);
    expect(box.sw).toBe(100);
    expect(box.sx).toBe(50);
  });

  it("distorts only when told to stretch", () => {
    const box = fitRect(image, 100, 100, "stretch");
    expect(box.dw).toBe(100);
    expect(box.dh).toBe(100);
    expect(box.sw).toBe(200);
    expect(box.sh).toBe(100);
  });
});
