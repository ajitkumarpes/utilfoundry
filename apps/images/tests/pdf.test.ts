import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { buildPdf, CAPTION_SPACE, FOOTER_SPACE, formatStamp, layoutPages, PAGE_SIZES, winAnsi } from "@/lib/pdf";
import type { SourceImage } from "@/lib/canvas/types";

const MM = 72 / 25.4;

function image(name: string, width: number, height: number, file?: File): SourceImage {
  return { id: name, name, size: 1, type: file?.type ?? "image/png", url: "", width, height, element: {} as HTMLImageElement, file };
}

describe("layoutPages", () => {
  const [pageWidth, pageHeight] = PAGE_SIZES.a4;

  it("centres one image per page inside the margins", () => {
    const [page] = layoutPages([image("wide.png", 1000, 500)], { pageSize: "a4", margin: 10, fit: "fit" });
    const [slot] = page.slots;
    expect(slot.width).toBeCloseTo(pageWidth - 20 * MM, 3);
    expect(slot.height).toBeCloseTo(slot.width / 2, 3);
    expect(slot.x).toBeCloseTo(10 * MM, 3);
    expect(slot.y + slot.height / 2).toBeCloseTo(pageHeight / 2, 3);
    expect(slot.caption).toBeNull();
  });

  it("reserves room under the image for its caption", () => {
    const [page] = layoutPages([image("tall-screenshot.png", 500, 2000)], { pageSize: "a4", margin: 10, captions: true });
    const [slot] = page.slots;
    expect(slot.caption).toBe("tall-screenshot.png");
    expect(slot.y + slot.height + CAPTION_SPACE).toBeLessThanOrEqual(pageHeight - 10 * MM + 0.001);
  });

  it("keeps page numbers clear of the image even with no margin", () => {
    const [page] = layoutPages([image("tall.png", 500, 2000)], { pageSize: "a4", margin: 0, pageNumbers: true });
    const [slot] = page.slots;
    expect(slot.y + slot.height).toBeLessThanOrEqual(pageHeight - FOOTER_SPACE + 0.001);
  });

  it("combines every image onto one page without overlaps", () => {
    const images = ["a", "b", "c", "d"].map((name) => image(`${name}.png`, 800, 600));
    const pages = layoutPages(images, { pageSize: "a4", margin: 10, mergeToOnePage: true, captions: true });
    expect(pages).toHaveLength(1);
    const slots = pages[0].slots;
    expect(slots).toHaveLength(4);
    for (const [index, a] of slots.entries()) {
      for (const b of slots.slice(index + 1)) {
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height + CAPTION_SPACE <= b.y || b.y + b.height + CAPTION_SPACE <= a.y;
        expect(apart).toBe(true);
      }
    }
  });
});

describe("PDF text", () => {
  it("replaces characters the built-in font cannot encode", () => {
    expect(winAnsi("Café – “draft” ☕ 日本.png")).toBe("Café – “draft” ? ??.png");
  });

  it("stamps a fixed, locale-free date", () => {
    expect(formatStamp(new Date(2026, 8, 5, 7, 4))).toBe("2026-09-05 07:04");
  });

  it("builds a document with captions, numbers and a date whatever the file names", async () => {
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#3366cc" } }).png().toBuffer();
    const file = new File([new Uint8Array(png)], "スクリーン ☕.png", { type: "image/png" });
    const blob = await buildPdf([image("スクリーン ☕.png", 40, 30, file), image("b.png", 40, 30, file)], {
      pageSize: "a4", margin: 10, captions: true, pageNumbers: true, timestamp: true
    });
    const pdf = await PDFDocument.load(await blob.arrayBuffer());
    expect(pdf.getPageCount()).toBe(2);
  });
});
