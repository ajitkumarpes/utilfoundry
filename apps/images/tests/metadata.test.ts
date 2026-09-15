import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aspectRatio, metadataToJson, metadataToText, readMetadata, type MetadataInput } from "@/lib/metadata";

function sample(name: string, type: string): MetadataInput {
  const bytes = readFileSync(new URL(`../public/samples/${name}`, import.meta.url));
  return {
    name,
    size: bytes.byteLength,
    type,
    bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  };
}

const find = (fields: { label: string; value: string }[], label: string) =>
  fields.find((field) => field.label === label)?.value;

describe("JPEG with EXIF", () => {
  const data = readMetadata(sample("photo-exif.jpg", "image/jpeg"));

  it("reads the frame size from the SOF marker", () => {
    expect(data.facts.width).toBe(1600);
    expect(data.facts.height).toBe(1067);
    expect(data.facts.format).toBe("JPEG");
    expect(data.facts.bitDepth).toBe(8);
  });

  it("reads camera identity from IFD0", () => {
    expect(find(data.exif, "Camera Make")).toBe("UtilFoundry");
    expect(find(data.exif, "Camera Model")).toBe("Foundry One Pro");
    expect(find(data.exif, "Software")).toBe("UtilFoundry Images 1.0");
  });

  it("formats exposure settings the way a camera would show them", () => {
    expect(find(data.exif, "Exposure Time")).toBe("1/1216 sec");
    expect(find(data.exif, "F Number")).toBe("f/1.8");
    expect(find(data.exif, "ISO")).toBe("ISO 50");
    expect(find(data.exif, "Focal Length")).toBe("6.86 mm");
    expect(find(data.exif, "Lens Model")).toBe("UtilFoundry 26mm f/1.8");
  });

  it("normalises the EXIF date separator", () => {
    expect(find(data.exif, "Date Taken")).toBe("2026-03-12 10:24:32");
  });

  it("converts GPS rationals to signed decimal degrees", () => {
    expect(data.gps).not.toBeNull();
    expect(data.gps?.latitude).toBeCloseTo(37.8651, 4);
    expect(data.gps?.longitude).toBeCloseTo(-119.5383, 4);
    expect(find(data.exif, "GPS Location")).toContain("N");
    expect(find(data.exif, "GPS Location")).toContain("W");
  });

  it("counts only the metadata fields, not the file facts", () => {
    expect(data.count).toBe(data.exif.length + data.iptc.length + data.xmp.length);
    expect(data.count).toBeGreaterThan(10);
  });

  it("exports the same values as text and JSON", () => {
    expect(metadataToText(data)).toContain("Camera Model: Foundry One Pro");
    const json = JSON.parse(metadataToJson(data));
    expect(json.exif["Camera Make"]).toBe("UtilFoundry");
    expect(json.gps.latitude).toBeCloseTo(37.8651, 4);
  });
});

describe("other containers", () => {
  it("reads PNG header facts", () => {
    const data = readMetadata(sample("mark.png", "image/png"));
    expect(data.facts.format).toBe("PNG");
    expect(data.facts.width).toBe(512);
    expect(data.facts.height).toBe(512);
    expect(data.facts.colorSpace).toBe("RGB + alpha");
    expect(data.facts.hasAlpha).toBe(true);
  });

  it("counts GIF frames without decoding them", () => {
    const data = readMetadata(sample("loader.gif", "image/gif"));
    expect(data.facts.format).toBe("GIF");
    expect(data.facts.width).toBe(320);
    expect(data.facts.height).toBe(200);
    expect(data.facts.frames).toBe(16);
  });

  it("reports a photo with the metadata stripped as having none", () => {
    const data = readMetadata(sample("landscape.jpg", "image/jpeg"));
    expect(data.facts.width).toBe(1600);
    expect(data.count).toBe(0);
    expect(data.gps).toBeNull();
  });

  it("still reports file facts for an unrecognised container", () => {
    const data = readMetadata({ name: "x.bin", size: 4, type: "application/octet-stream", bytes: new Uint8Array([1, 2, 3, 4]).buffer });
    expect(data.facts.width).toBe(0);
    expect(data.count).toBe(0);
  });

  it("refuses an empty file", () => {
    expect(() => readMetadata({ name: "x", size: 0, type: "", bytes: new ArrayBuffer(0) })).toThrow();
  });
});

describe("aspect ratio", () => {
  it("reduces exact ratios", () => {
    expect(aspectRatio(1920, 1080)).toBe("16:9");
    expect(aspectRatio(1000, 1000)).toBe("1:1");
  });

  it("snaps awkward sensor sizes to the familiar ratio", () => {
    expect(aspectRatio(4032, 3024)).toBe("4:3");
    expect(aspectRatio(1600, 1067)).toBe("3:2");
  });

  it("falls back to a decimal for genuinely odd shapes", () => {
    expect(aspectRatio(1000, 137)).toBe("7.3:1");
    expect(aspectRatio(0, 0)).toBe("—");
  });
});
