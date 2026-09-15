import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { decodeBase64Payload, sniffImageType, toSnippet } from "@/lib/base64";

async function png() {
  return sharp({ create: { width: 3, height: 2, channels: 4, background: "#ff0000" } }).png().toBuffer();
}

describe("decodeBase64Payload", () => {
  it("decodes a data URI and reports what the bytes really are", async () => {
    const bytes = await png();
    const decoded = decodeBase64Payload(`data:image/jpeg;base64,${bytes.toString("base64")}`);
    expect(Buffer.from(decoded.bytes).equals(bytes)).toBe(true);
    expect(decoded.declared).toBe("image/jpeg");
    expect(decoded.mime).toBe("image/png");
  });

  it("accepts bare, wrapped, URL-safe and unpadded Base64", async () => {
    const bytes = await png();
    const standard = bytes.toString("base64");
    const messy = standard.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").replace(/(.{20})/g, "$1\n  ");
    const decoded = decodeBase64Payload(messy);
    expect(Buffer.from(decoded.bytes).equals(bytes)).toBe(true);
    expect(decoded.base64).toBe(standard);
  });

  it("explains what is wrong with a bad payload", () => {
    expect(() => decodeBase64Payload("   ")).toThrow("Paste a Base64 string first.");
    expect(() => decodeBase64Payload("not base64 at all!")).toThrow("not valid in Base64");
    expect(() => decodeBase64Payload("iVBORw0KG")).toThrow("cut off");
    expect(() => decodeBase64Payload("data:image/png,%89PNG")).toThrow("not Base64-encoded");
  });
});

describe("sniffImageType", () => {
  it("recognises the common signatures", () => {
    const of = (text: string) => new Uint8Array([...text].map((char) => char.charCodeAt(0)));
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(of("GIF89a"))).toBe("image/gif");
    expect(sniffImageType(of("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(of("\0\0\0\x1cftypavif"))).toBe("image/avif");
    expect(sniffImageType(of("  <svg xmlns='http://www.w3.org/2000/svg'/>"))).toBe("image/svg+xml");
    expect(sniffImageType(of("hello"))).toBeNull();
  });
});

describe("toSnippet", () => {
  const uri = "data:image/png;base64,AAAA";
  const meta = { name: "brand-mark.png", width: 32, height: 16 };

  it("offers every paste-ready form", () => {
    expect(toSnippet("data-uri", uri, meta)).toBe(uri);
    expect(toSnippet("raw", uri, meta)).toBe("AAAA");
    expect(toSnippet("html", uri, meta)).toBe(`<img src="${uri}" alt="brand mark" width="32" height="16" />`);
    expect(toSnippet("css", uri, meta)).toBe(`background-image: url("${uri}");`);
    expect(JSON.parse(toSnippet("json", uri, meta))).toEqual({ name: "brand-mark.png", mime: "image/png", width: 32, height: 16, data: "AAAA" });
  });
});
