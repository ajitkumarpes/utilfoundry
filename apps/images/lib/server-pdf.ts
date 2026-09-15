import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { ProcessingError } from "@/lib/errors";

const MAX_PIXELS = 40_000_000;
const MAX_PDF_IMAGES = 20;
const MM_TO_PT = 72 / 25.4;

const PAGE_SIZES: Record<string, [number, number]> = {
  a3: [841.89, 1190.55],
  a4: [595.28, 841.89],
  a5: [419.53, 595.28],
  letter: [612, 792],
  legal: [612, 1008]
};

/**
 * Server-side PDF generation. The browser builds PDFs itself for the normal flow;
 * this path keeps the API usable without JavaScript and backs the route tests.
 */
export async function imagePdf(files: { buffer: Buffer; name: string }[], formData: FormData) {
  if (!files.length) throw new ProcessingError("Add at least one image before creating a PDF.");
  if (files.length > MAX_PDF_IMAGES) throw new ProcessingError(`A PDF can hold up to ${MAX_PDF_IMAGES} images.`);

  const pageSize = String(formData.get("pageSize") ?? "a4");
  const orientation = String(formData.get("orientation") ?? "portrait");
  const fit = String(formData.get("fit") ?? "fit");
  const margin = Math.max(0, Number(formData.get("margin") ?? 10)) * MM_TO_PT;

  const pdf = await PDFDocument.create();
  pdf.setProducer("UtilFoundry Images");

  for (const file of files) {
    const source = sharp(file.buffer, { limitInputPixels: MAX_PIXELS, sequentialRead: true });
    const metadata = await source.metadata();
    const sourceWidth = metadata.width ?? 1;
    const sourceHeight = metadata.height ?? 1;

    let pageWidth: number;
    let pageHeight: number;
    if (pageSize === "original") {
      pageWidth = sourceWidth * 0.75;
      pageHeight = sourceHeight * 0.75;
    } else {
      const [portraitWidth, portraitHeight] = PAGE_SIZES[pageSize] ?? PAGE_SIZES.a4;
      [pageWidth, pageHeight] = orientation === "landscape"
        ? [portraitHeight, portraitWidth]
        : [portraitWidth, portraitHeight];
    }

    const boxWidth = Math.max(1, pageWidth - margin * 2);
    const boxHeight = Math.max(1, pageHeight - margin * 2);
    const scale = fit === "fill"
      ? Math.max(boxWidth / sourceWidth, boxHeight / sourceHeight)
      : Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
    const drawWidth = fit === "stretch" ? boxWidth : sourceWidth * scale;
    const drawHeight = fit === "stretch" ? boxHeight : sourceHeight * scale;

    const page = pdf.addPage([pageWidth, pageHeight]);
    const embedded = metadata.format === "jpeg"
      ? await pdf.embedJpg(await source.jpeg({ quality: 95 }).toBuffer())
      : await pdf.embedPng(await source.png().toBuffer());

    page.drawImage(embedded, {
      x: (pageWidth - drawWidth) / 2,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight
    });
  }

  return pdf.save();
}
