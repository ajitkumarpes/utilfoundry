import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { POST } from "@/app/api/process/route";

async function samplePng(width = 320, height = 200) {
  return sharp({ create: { width, height, channels: 4, background: { r: 235, g: 120, b: 40, alpha: 1 } } }).png().toBuffer();
}

function toFile(bytes: Buffer, name: string) {
  const slice = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([slice], name, { type: "image/png" });
}

async function processImage(tool: string, fields: Record<string, string> = {}, inputs?: Buffer[]) {
  const buffers = inputs ?? [await samplePng()];
  const form = new FormData();
  form.append("tool", tool);
  buffers.forEach((buffer, index) => form.append("file", toFile(buffer, `sample-${index}.png`)));
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  return POST(new Request("http://localhost/api/process", { method: "POST", body: form }));
}

async function metadataOf(response: Response) {
  return sharp(Buffer.from(await response.arrayBuffer())).metadata();
}

describe("image processing route", () => {
  it("rejects unknown tools", async () => {
    const response = await processImage("does-not-exist");
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Unknown image operation");
  });

  it("encodes compressed output in the requested format", async () => {
    const response = await processImage("image-compressor", { format: "webp", quality: "80" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/webp");
    expect((await metadataOf(response)).format).toBe("webp");
  });

  it("converts to AVIF, which the browser cannot encode itself", async () => {
    const response = await processImage("image-converter", { format: "avif", quality: "60" });
    expect(response.status).toBe(200);
    expect((await metadataOf(response)).format).toBe("heif");
  });

  it("keeps the source format when none is requested", async () => {
    const response = await processImage("remove-metadata");
    expect((await metadataOf(response)).format).toBe("png");
  });

  it("applies crop aspect-ratio settings", async () => {
    const response = await processImage("crop-image", { ratio: "square", cropWidth: "300", cropHeight: "200", left: "0", top: "0" });
    expect(response.status).toBe(200);
    const metadata = await metadataOf(response);
    expect([metadata.width, metadata.height]).toEqual([200, 200]);
  });

  it("swaps dimensions on a quarter rotation", async () => {
    const response = await processImage("rotate-image", { angle: "90" });
    const metadata = await metadataOf(response);
    expect([metadata.width, metadata.height]).toEqual([200, 320]);
  });

  it("refuses a rotation that is not a quarter turn", async () => {
    const response = await processImage("rotate-image", { angle: "45" });
    expect(response.status).toBe(400);
  });

  it("resizes without enlarging past the source", async () => {
    const response = await processImage("resize-image", { resizeMode: "pixels", width: "4000", preventEnlargement: "true" });
    const metadata = await metadataOf(response);
    expect(metadata.width).toBe(320);
  });

  it("creates a valid PDF from one image", async () => {
    const response = await processImage("image-to-pdf", { pageSize: "a4", orientation: "portrait", margin: "10" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("creates one PDF page per image", async () => {
    const response = await processImage(
      "image-to-pdf",
      { pageSize: "a4", orientation: "portrait", margin: "10" },
      [await samplePng(), await samplePng(200, 400), await samplePng(500, 100)]
    );
    expect(response.status).toBe(200);
    const pdf = await PDFDocument.load(await response.arrayBuffer());
    expect(pdf.getPageCount()).toBe(3);
  });

  it("round-trips a Base64 image payload", async () => {
    const encoded = await processImage("image-to-base64", { base64Mode: "data-uri" });
    const payload = (await encoded.json()) as { data: string };
    expect(payload.data.startsWith("data:image/png;base64,")).toBe(true);

    const form = new FormData();
    form.append("tool", "base64-to-image");
    form.append("base64", payload.data);
    const decoded = await POST(new Request("http://localhost/api/process", { method: "POST", body: form }));
    expect(decoded.status).toBe(200);
    const metadata = await metadataOf(decoded);
    expect([metadata.width, metadata.height]).toEqual([320, 200]);
  });

  it("returns a useful service-unavailable response when the ML worker is down", async () => {
    // Refuse the connection outright so the result does not depend on whether a
    // worker happens to be running on this machine.
    const refused = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("fetch failed"));
    try {
      const response = await processImage("ocr-image", { language: "eng", psm: "6" });
      expect(response.status).toBe(503);
      expect((await response.json()).error).toContain("local image worker is unavailable");
    } finally {
      refused.mockRestore();
    }
  });

  it("refuses a request with no file", async () => {
    const form = new FormData();
    form.append("tool", "image-compressor");
    const response = await POST(new Request("http://localhost/api/process", { method: "POST", body: form }));
    expect(response.status).toBe(400);
  });
});

describe("image compressor", () => {
  const compress = (input: Buffer, fields: Record<string, string>) => processImage("image-compressor", fields, [input]);

  it("quantises PNGs to a palette, which is where the real savings are", async () => {
    const noisy = await sharp({ create: { width: 360, height: 240, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma: 40 } } }).png().toBuffer();
    const response = await compress(noisy, { quality: "70", format: "auto" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const output = Buffer.from(await response.arrayBuffer());
    expect(output.length).toBeLessThan(noisy.length * 0.6);
    expect((await sharp(output).metadata()).width).toBe(360);
  });

  it("hands back the original when re-encoding would only make it bigger", async () => {
    const small = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#3366cc" } }).jpeg({ quality: 20 }).toBuffer();
    const response = await compress(small, { quality: "100", format: "auto" });
    expect(response.headers.get("x-compression")).toBe("original");
    expect(Buffer.from(await response.arrayBuffer()).equals(small)).toBe(true);
  });

  it("applies the EXIF orientation, since the output carries no metadata", async () => {
    const sideways = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#cc6633" } })
      .jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const response = await compress(sideways, { quality: "80", format: "webp" });
    const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    expect([meta.width, meta.height]).toEqual([200, 300]);
    expect(response.headers.get("x-image-width")).toBe("200");
  });

  it("switches to WebP when the original format need not be kept", async () => {
    const response = await compress(await samplePng(), { quality: "80", format: "auto", keepFormat: "false" });
    expect(response.headers.get("content-type")).toBe("image/webp");
  });
});

describe("image converter", () => {
  const convert = (fields: Record<string, string>, input?: Buffer) => processImage("image-converter", fields, input ? [input] : undefined);

  it("keeps every frame when an animated GIF becomes WebP", async () => {
    const { readFileSync } = await import("node:fs");
    const gif = readFileSync(new URL("../public/samples/loader.gif", import.meta.url));
    const frames = (await sharp(gif).metadata()).pages;
    expect(frames).toBeGreaterThan(1);
    const meta = await metadataOf(await convert({ format: "webp" }, gif));
    expect(meta.format).toBe("webp");
    expect(meta.pages).toBe(frames);
  });

  it("resizes inside the requested box and never enlarges", async () => {
    const half = await metadataOf(await convert({ format: "png", width: "160" }));
    expect([half.width, half.height]).toEqual([160, 100]);
    const capped = await metadataOf(await convert({ format: "png", width: "4000" }));
    expect(capped.width).toBe(320);
  });

  it("puts transparent areas on white for JPEG", async () => {
    const clear = await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const response = await convert({ format: "jpeg" }, clear);
    const { data } = await sharp(Buffer.from(await response.arrayBuffer())).raw().toBuffer({ resolveWithObject: true });
    expect(Math.min(data[0], data[1], data[2])).toBeGreaterThan(245);
  });

  it("writes GIF, which the browser cannot encode", async () => {
    expect((await metadataOf(await convert({ format: "gif" }))).format).toBe("gif");
  });
});
