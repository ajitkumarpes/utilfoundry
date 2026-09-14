import { PDFDocument } from "pdf-lib";
import sharp, { type FormatEnum, type Sharp } from "sharp";
import { isToolId, parseBase64, safeInteger, type OutputFormat } from "@/lib/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_INPUT_BYTES = 32 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  pdf: "application/pdf"
};

function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function filename(value: string | undefined, suffix: string) {
  const clean = (value ?? "image").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
  return `${clean.replace(/\.[^.]+$/, "")}-${suffix}`;
}

async function readImage(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Choose an image file first.");
  if (!file.size || file.size > MAX_INPUT_BYTES) throw new Error("Images must be between 1 byte and 32 MB.");
  return { buffer: Buffer.from(await file.arrayBuffer()), name: file.name };
}

function formatOf(value: string | null): OutputFormat {
  if (value === "png" || value === "webp" || value === "avif") return value;
  return "jpeg";
}

async function encode(image: Sharp, format: OutputFormat, quality: number) {
  const options: Record<string, unknown> = format === "jpeg"
    ? { quality, mozjpeg: true }
    : format === "png"
      ? { compressionLevel: 9, adaptiveFiltering: true }
      : { quality, effort: 4 };
  return image.toFormat(format as keyof FormatEnum, options).toBuffer();
}

async function imagePdf(input: Buffer) {
  const source = sharp(input, { limitInputPixels: MAX_PIXELS, sequentialRead: true });
  const metadata = await source.metadata();
  const width = metadata.width ?? 1;
  const height = metadata.height ?? 1;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([width, height]);
  if (metadata.format === "jpeg") {
    const jpg = await source.jpeg({ quality: 95 }).toBuffer();
    page.drawImage(await pdf.embedJpg(jpg), { x: 0, y: 0, width, height });
  } else {
    const png = await source.png().toBuffer();
    page.drawImage(await pdf.embedPng(png), { x: 0, y: 0, width, height });
  }
  return pdf.save();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const rawTool = formData.get("tool");
    const tool = typeof rawTool === "string" ? rawTool : "";
    if (!isToolId(tool)) return errorResponse("Unknown image operation.");

    let input: Buffer;
    let originalName = "image";
    if (tool === "base64-to-image") {
      const value = formData.get("base64");
      if (typeof value !== "string") return errorResponse("Paste a Base64 image payload first.");
      input = parseBase64(value).buffer;
    } else {
      const file = await readImage(formData);
      input = file.buffer;
      originalName = file.name;
    }

    const source = sharp(input, { limitInputPixels: MAX_PIXELS, sequentialRead: true });
    const metadata = await source.metadata();
    if (!metadata.width || !metadata.height || !metadata.format) throw new Error("The file is not a supported image.");

    if (tool === "image-to-base64") {
      const format = metadata.format === "jpeg" ? "jpeg" : metadata.format;
      const mime = MIME_BY_FORMAT[format] ?? "application/octet-stream";
      const data = `data:${mime};base64,${input.toString("base64")}`;
      return Response.json({ data, bytes: input.length, format, width: metadata.width, height: metadata.height }, { headers: { "Cache-Control": "no-store" } });
    }

    if (tool === "image-to-pdf" || tool === "screenshot-to-pdf") {
      const pdf = await imagePdf(input);
      return new Response(new Uint8Array(pdf), {
        headers: {
          "Content-Type": MIME_BY_FORMAT.pdf,
          "Content-Disposition": `attachment; filename="${filename(originalName, "converted.pdf")}"`,
          "Cache-Control": "no-store"
        }
      });
    }

    if (tool === "base64-to-image") {
      const output = await source.png().toBuffer();
      return new Response(new Uint8Array(output), {
        headers: {
          "Content-Type": MIME_BY_FORMAT.png,
          "Content-Disposition": `attachment; filename="${filename("decoded", "image.png")}"`,
          "Cache-Control": "no-store"
        }
      });
    }

    let image = source;
    const quality = safeInteger(formData.get("quality"), 78, 20, 100);
    if (tool === "compress") {
      // Encoding alone is intentional: dimensions remain unchanged while quality/codec changes.
    } else if (tool === "resize") {
      const width = safeInteger(formData.get("width"), 0, 1, 12_000);
      const height = safeInteger(formData.get("height"), 0, 1, 12_000);
      if (!width && !height) throw new Error("Enter a target width or height.");
      image = image.resize(width || undefined, height || undefined, { fit: "inside", withoutEnlargement: true });
    } else if (tool === "crop") {
      const width = safeInteger(formData.get("width"), 0, 1, metadata.width);
      const height = safeInteger(formData.get("height"), 0, 1, metadata.height);
      const left = safeInteger(formData.get("left"), 0, 0, Math.max(0, metadata.width - width));
      const top = safeInteger(formData.get("top"), 0, 0, Math.max(0, metadata.height - height));
      if (!width || !height) throw new Error("Enter crop width and height.");
      image = image.extract({ left, top, width, height });
    } else if (tool === "convert") {
      // Target format is applied below.
    } else if (tool === "rotate") {
      const angle = Number(formData.get("angle"));
      if (![90, 180, 270].includes(angle)) throw new Error("Choose a 90°, 180° or 270° rotation.");
      image = image.rotate(angle);
    } else if (tool === "flip") {
      const direction = formData.get("direction");
      if (direction === "vertical") image = image.flip();
      else if (direction === "horizontal") image = image.flop();
      else throw new Error("Choose a flip direction.");
    } else if (tool === "strip-metadata") {
      // Sharp omits metadata by default. Re-encoding also removes EXIF and GPS blocks.
    }

    const fallback: OutputFormat = metadata.format === "png" ? "png" : metadata.format === "webp" ? "webp" : "jpeg";
    const format = tool === "convert" || tool === "compress" ? formatOf(typeof formData.get("format") === "string" ? String(formData.get("format")) : fallback) : fallback;
    const output = await encode(image, format, quality);
    const suffix = `${tool}.${format === "jpeg" ? "jpg" : format}`;
    return new Response(new Uint8Array(output), {
      headers: {
        "Content-Type": MIME_BY_FORMAT[format],
        "Content-Disposition": `attachment; filename="${filename(originalName, suffix)}"`,
        "Cache-Control": "no-store",
        "X-Image-Width": String(metadata.width),
        "X-Image-Height": String(metadata.height)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image processing failed.";
    return errorResponse(message.length > 180 ? "The image could not be processed. Check its format and size." : message);
  }
}
