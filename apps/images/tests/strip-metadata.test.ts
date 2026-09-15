import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { readMetadata } from "@/lib/metadata";
import { stripMetadata } from "@/lib/strip-metadata";

const load = (name: string) => new Uint8Array(readFileSync(new URL(`../public/samples/${name}`, import.meta.url)));
const inspect = (bytes: Uint8Array, type: string) =>
  readMetadata({ name: "x", size: bytes.length, type, bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer });
const label = (bytes: Uint8Array, name: string) => inspect(bytes, "image/jpeg").exif.find((field) => field.label === name)?.value;

/** Everything from the start-of-scan marker onward: the compressed pixels. */
function scanData(bytes: Uint8Array) {
  for (let at = 2; at < bytes.length - 1; at += 1) if (bytes[at] === 0xff && bytes[at + 1] === 0xda) return bytes.subarray(at);
  throw new Error("no SOS");
}

describe("JPEG", () => {
  const source = load("photo-exif.jpg");

  it("removes every metadata field in 'all' mode", () => {
    const result = stripMetadata(source, "all")!;
    expect(inspect(result.bytes, "image/jpeg").count).toBe(0);
    expect(result.removed).toContain("EXIF");
    expect(result.bytes.length).toBeLessThan(source.length);
  });

  it("copies the compressed image data through byte for byte", () => {
    const result = stripMetadata(source, "all")!;
    expect(Buffer.from(scanData(result.bytes)).equals(Buffer.from(scanData(source)))).toBe(true);
  });

  it("decodes to exactly the same pixels", async () => {
    const result = stripMetadata(source, "all")!;
    const before = await sharp(source).raw().toBuffer();
    const after = await sharp(Buffer.from(result.bytes)).raw().toBuffer();
    expect(after.equals(before)).toBe(true);
  });

  it("removes only the location in 'gps' mode", () => {
    const result = stripMetadata(source, "gps")!;
    expect(inspect(result.bytes, "image/jpeg").gps).toBeNull();
    expect(label(result.bytes, "Camera Make")).toBe("UtilFoundry");
    expect(label(result.bytes, "Date Taken")).toBe("2026-03-12 10:24:32");
    expect(result.removed).toContain("GPS location");
  });

  it("removes only camera identity in 'camera' mode", () => {
    const result = stripMetadata(source, "camera")!;
    expect(label(result.bytes, "Camera Make")).toBeUndefined();
    expect(label(result.bytes, "Camera Model")).toBeUndefined();
    expect(label(result.bytes, "Lens Model")).toBeUndefined();
    expect(label(result.bytes, "Software")).toBe("UtilFoundry Images 1.0");
    expect(inspect(result.bytes, "image/jpeg").gps).not.toBeNull();
  });

  it("removes only software details in 'software' mode", () => {
    const result = stripMetadata(source, "software")!;
    expect(label(result.bytes, "Software")).toBeUndefined();
    expect(label(result.bytes, "Camera Make")).toBe("UtilFoundry");
    expect(inspect(result.bytes, "image/jpeg").gps).not.toBeNull();
  });

  it("keeps exposure settings when only the location goes", () => {
    const result = stripMetadata(source, "gps")!;
    expect(label(result.bytes, "Exposure Time")).toBe("1/1216 sec");
    expect(label(result.bytes, "F Number")).toBe("f/1.8");
  });

  it("leaves a file without metadata unchanged", () => {
    const plain = load("landscape.jpg");
    const result = stripMetadata(plain, "all")!;
    expect(result.removed).toEqual([]);
    expect(result.bytes.length).toBe(plain.length);
  });
});

describe("WebP", () => {
  it("drops EXIF, fixes the header flags and stays decodable", async () => {
    const webp = new Uint8Array(await sharp(Buffer.from(load("photo-exif.jpg"))).webp({ quality: 80 }).withMetadata().toBuffer());
    expect(inspect(webp, "image/webp").count).toBeGreaterThan(0);

    const result = stripMetadata(webp, "all")!;
    expect(inspect(result.bytes, "image/webp").count).toBe(0);
    const meta = await sharp(Buffer.from(result.bytes)).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(1600);
    expect(meta.exif).toBeUndefined();
  });

  it("rewrites EXIF in place for selective modes", async () => {
    const webp = new Uint8Array(await sharp(Buffer.from(load("photo-exif.jpg"))).webp({ quality: 80 }).withMetadata().toBuffer());
    const result = stripMetadata(webp, "gps")!;
    const data = inspect(result.bytes, "image/webp");
    expect(data.gps).toBeNull();
    expect(data.exif.find((field) => field.label === "Camera Make")?.value).toBe("UtilFoundry");
    expect((await sharp(Buffer.from(result.bytes)).metadata()).width).toBe(1600);
  });
});

describe("PNG", () => {
  it("drops text and EXIF chunks and stays decodable", async () => {
    const png = new Uint8Array(await sharp(Buffer.from(load("photo-exif.jpg"))).png().withMetadata().toBuffer());
    const result = stripMetadata(png, "all")!;
    expect(inspect(result.bytes, "image/png").count).toBe(0);
    const meta = await sharp(Buffer.from(result.bytes)).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(1600);
  });
});

describe("unsupported containers", () => {
  it("returns null so the caller can fall back to re-encoding", () => {
    expect(stripMetadata(load("loader.gif"), "all")).toBeNull();
  });
});
