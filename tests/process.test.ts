import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { POST } from "@/app/api/process/route";

async function samplePng() {
  return sharp({ create: { width: 320, height: 200, channels: 4, background: { r: 235, g: 120, b: 40, alpha: 1 } } }).png().toBuffer();
}

async function processImage(tool: string, fields: Record<string, string> = {}, input?: Buffer) {
  const bytes = input ?? await samplePng();
  const form = new FormData();
  form.append("tool", tool);
  const fileBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  form.append("file", new File([fileBytes], "sample.png", { type: "image/png" }));
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  return POST(new Request("http://localhost/api/process", { method: "POST", body: form }));
}

describe("image processing route", () => {
  it("encodes compressed output in the requested format", async () => {
    const response = await processImage("compress", { format: "webp", quality: "80" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/webp");
    expect((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format).toBe("webp");
  });

  it("applies crop aspect-ratio settings", async () => {
    const response = await processImage("crop", { ratio: "square", width: "300", height: "200", left: "0", top: "0" });
    expect(response.status).toBe(200);
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(200);
  });

  it("creates a valid PDF from an image", async () => {
    const response = await processImage("image-to-pdf", { pageSize: "a4", orientation: "portrait", margin: "small" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("round-trips a Base64 image payload", async () => {
    const input = await samplePng();
    const encoded = await processImage("image-to-base64", { base64Mode: "data-uri" }, input);
    const payload = (await encoded.json()) as { data: string };
    const form = new FormData();
    form.append("tool", "base64-to-image");
    form.append("base64", payload.data);
    const decoded = await POST(new Request("http://localhost/api/process", { method: "POST", body: form }));
    expect(decoded.status).toBe(200);
    expect(decoded.headers.get("content-type")).toContain("image/png");
    const metadata = await sharp(Buffer.from(await decoded.arrayBuffer())).metadata();
    expect([metadata.width, metadata.height]).toEqual([320, 200]);
  });

  it("returns a useful service-unavailable response when the ML worker is down", async () => {
    const response = await processImage("ocr", { language: "eng", psm: "6" });
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("local image worker is unavailable");
  });
});
