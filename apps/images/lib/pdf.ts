import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { SourceImage, ToolOptions } from "@/lib/canvas/types";
import { canvasToBlob } from "@/lib/canvas/encode";
import { context, createCanvas } from "@/lib/canvas/effects";

/** Page sizes in PDF points (72 per inch). */
export const PAGE_SIZES: Record<string, [number, number]> = {
  a3: [841.89, 1190.55],
  a4: [595.28, 841.89],
  a5: [419.53, 595.28],
  letter: [612, 792],
  legal: [612, 1008]
};

const MM_TO_PT = 72 / 25.4;
/** Room kept under an image for its file-name caption, in points. */
export const CAPTION_SPACE = 16;
/** Clearance kept at the foot of a page for the page number and date. */
export const FOOTER_SPACE = 26;

export type Slot = {
  image: SourceImage;
  /** Placement in points from the top-left corner. */
  x: number;
  y: number;
  width: number;
  height: number;
  caption: string | null;
};

export type PageLayout = { pageWidth: number; pageHeight: number; slots: Slot[] };

const flag = (options: ToolOptions, key: string) => options[key] === true || options[key] === "true";

function pageDimensions(options: ToolOptions, first: SourceImage) {
  const size = String(options.pageSize ?? "a4");
  if (size === "original") {
    // Treat source pixels as 96 dpi, the CSS reference, so a screenshot prints at its natural size.
    return [first.width * 0.75, first.height * 0.75] as [number, number];
  }
  const [width, height] = PAGE_SIZES[size] ?? PAGE_SIZES.a4;
  return String(options.orientation ?? "portrait") === "landscape"
    ? [height, width] as [number, number]
    : [width, height] as [number, number];
}

function place(image: SourceImage, boxWidth: number, boxHeight: number, fit: string) {
  const ratio = image.width / image.height;
  if (fit === "stretch") return { width: boxWidth, height: boxHeight };
  if (fit === "actual") {
    const width = Math.min(boxWidth, image.width * 0.75);
    return { width, height: width / ratio };
  }
  const scale = fit === "fill"
    ? Math.max(boxWidth / image.width, boxHeight / image.height)
    : Math.min(boxWidth / image.width, boxHeight / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

/** Works out the page layout, shared by the on-screen preview and the real PDF. */
export function layoutPages(images: SourceImage[], options: ToolOptions): PageLayout[] {
  if (!images.length) return [];
  const ordered = String(options.order ?? "selected") === "alphabetical"
    ? [...images].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    : images;

  const margin = Math.max(0, Number(options.margin ?? 10) || 0) * MM_TO_PT;
  const fit = String(options.fit ?? "fit");
  const captions = flag(options, "captions");
  const caption = captions ? CAPTION_SPACE : 0;
  // Only the part of the footer the margin does not already cover is taken from the image.
  const footer = flag(options, "pageNumbers") || flag(options, "timestamp") ? Math.max(0, FOOTER_SPACE - margin) : 0;

  if (flag(options, "mergeToOnePage")) {
    const [pageWidth, pageHeight] = pageDimensions(options, ordered[0]);
    const columns = Math.ceil(Math.sqrt(ordered.length));
    const rows = Math.ceil(ordered.length / columns);
    const cellWidth = (pageWidth - margin * 2) / columns;
    const cellHeight = (pageHeight - margin * 2 - footer) / rows;
    const gap = Math.min(Math.max(margin, 4), 8);

    return [{
      pageWidth,
      pageHeight,
      slots: ordered.map((image, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const box = place(image, cellWidth - gap, cellHeight - gap - caption, fit);
        return {
          image,
          caption: captions ? image.name : null,
          x: margin + column * cellWidth + (cellWidth - box.width) / 2,
          y: margin + row * cellHeight + (cellHeight - caption - box.height) / 2,
          width: box.width,
          height: box.height
        };
      })
    }];
  }

  return ordered.map((image) => {
    const [pageWidth, pageHeight] = pageDimensions(options, image);
    const boxHeight = Math.max(1, pageHeight - margin * 2 - caption - footer);
    const box = place(image, Math.max(1, pageWidth - margin * 2), boxHeight, fit);
    return {
      pageWidth,
      pageHeight,
      slots: [{
        image,
        caption: captions ? image.name : null,
        x: (pageWidth - box.width) / 2,
        y: margin + (boxHeight - box.height) / 2,
        width: box.width,
        height: box.height
      }]
    };
  });
}

/**
 * pdf-lib's built-in Helvetica can only encode WinAnsi. Anything outside it
 * becomes "?" instead of making the whole export throw.
 */
export function winAnsi(text: string) {
  return text.replace(/[^\x20-\x7e\xa0-\xff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, "?");
}

/** "2026-09-15 18:24", the footer stamp: fixed format, so it always encodes. */
export function formatStamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Trims `text` with an ellipsis until it fits `width` points. */
function fitText(font: PDFFont, text: string, size: number, width: number) {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/** pdf-lib embeds PNG and JPEG only, so anything else is re-encoded first. */
async function embeddable(image: SourceImage): Promise<{ bytes: ArrayBuffer; type: "png" | "jpg" }> {
  const type = image.type.toLowerCase();
  if (image.file && (type === "image/png")) return { bytes: await image.file.arrayBuffer(), type: "png" };
  if (image.file && (type === "image/jpeg" || type === "image/jpg")) return { bytes: await image.file.arrayBuffer(), type: "jpg" };

  const canvas = createCanvas(image.width, image.height);
  context(canvas).drawImage(image.element, 0, 0);
  const blob = await canvasToBlob(canvas, "image/png", 100);
  return { bytes: await blob.arrayBuffer(), type: "png" };
}

export async function buildPdf(images: SourceImage[], options: ToolOptions, now = new Date()): Promise<Blob> {
  const pages = layoutPages(images, options);
  if (!pages.length) throw new Error("Add at least one image before creating a PDF.");

  const pdf = await PDFDocument.create();
  pdf.setProducer("UtilFoundry Images");
  pdf.setCreator("UtilFoundry Images");
  pdf.setCreationDate(now);

  const showNumbers = flag(options, "pageNumbers");
  const stamp = flag(options, "timestamp") ? formatStamp(now) : "";
  const needsFont = showNumbers || Boolean(stamp) || pages.some((layout) => layout.slots.some((slot) => slot.caption));
  const font = needsFont ? await pdf.embedFont(StandardFonts.Helvetica) : null;
  const grey = rgb(0.42, 0.47, 0.54);
  const cache = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>();

  for (const [index, layout] of pages.entries()) {
    const page = pdf.addPage([layout.pageWidth, layout.pageHeight]);
    for (const slot of layout.slots) {
      let embedded = cache.get(slot.image.id);
      if (!embedded) {
        const source = await embeddable(slot.image);
        embedded = source.type === "png" ? await pdf.embedPng(source.bytes) : await pdf.embedJpg(source.bytes);
        cache.set(slot.image.id, embedded);
      }
      page.drawImage(embedded, {
        x: slot.x,
        // pdf-lib measures from the bottom-left; the layout is top-left based.
        y: layout.pageHeight - slot.y - slot.height,
        width: slot.width,
        height: slot.height
      });
      if (font && slot.caption) {
        const size = 8.5;
        const text = fitText(font, winAnsi(slot.caption), size, Math.max(slot.width, 72));
        page.drawText(text, {
          x: slot.x + (slot.width - font.widthOfTextAtSize(text, size)) / 2,
          y: layout.pageHeight - slot.y - slot.height - 11,
          size,
          font,
          color: rgb(0.29, 0.33, 0.39)
        });
      }
    }
    if (font && showNumbers) {
      const label = `${index + 1} / ${pages.length}`;
      page.drawText(label, { x: (layout.pageWidth - font.widthOfTextAtSize(label, 9)) / 2, y: 12, size: 9, font, color: grey });
    }
    if (font && stamp) {
      page.drawText(stamp, { x: layout.pageWidth - 18 - font.widthOfTextAtSize(stamp, 8), y: 12, size: 8, font, color: grey });
    }
  }

  return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
}
