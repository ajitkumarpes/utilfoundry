import { PDFDocument } from "pdf-lib";
import sharp, { type FormatEnum, type Sharp } from "sharp";
import { isToolId, parseBase64, safeInteger, type OutputFormat } from "@/lib/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_INPUT_BYTES = 32 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const WORKER_URL = process.env.IMAGE_WORKER_URL ?? "http://127.0.0.1:8094";
const WORKER_TOOLS = new Set(["ocr", "screenshot-to-text", "remove-background", "upscale"]);
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

class ProcessingError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

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

async function imagePdf(input: Buffer, formData: FormData) {
  const source = sharp(input, { limitInputPixels: MAX_PIXELS, sequentialRead: true });
  const metadata = await source.metadata();
  const sourceWidth = metadata.width ?? 1;
  const sourceHeight = metadata.height ?? 1;
  const pageSize = String(formData.get("pageSize") ?? "original");
  const orientation = String(formData.get("orientation") ?? "portrait");
  const margin = formData.get("margin") === "none" ? 0 : 24;
  let width = sourceWidth;
  let height = sourceHeight;
  if (pageSize === "a4") [width, height] = orientation === "landscape" ? [842, 595] : [595, 842];
  if (pageSize === "letter") [width, height] = orientation === "landscape" ? [792, 612] : [612, 792];
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([width, height]);
  const scale = Math.min(Math.max(1, width - margin * 2) / sourceWidth, Math.max(1, height - margin * 2) / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;
  if (metadata.format === "jpeg") {
    const jpg = await source.jpeg({ quality: 95 }).toBuffer();
    page.drawImage(await pdf.embedJpg(jpg), { x: drawX, y: drawY, width: drawWidth, height: drawHeight });
  } else {
    const png = await source.png().toBuffer();
    page.drawImage(await pdf.embedPng(png), { x: drawX, y: drawY, width: drawWidth, height: drawHeight });
  }
  return pdf.save();
}

async function processWithWorker(tool: string, input: Buffer, originalName: string, formData: FormData) {
  const body = new FormData();
  body.append("tool", tool);
  const fileBytes = new Uint8Array(input.byteLength);
  fileBytes.set(input);
  body.append("file", new Blob([fileBytes.buffer]), originalName);
  for (const key of ["language", "psm", "scale"]) {
    const value = formData.get(key);
    if (typeof value === "string" && value) body.append(key, value);
  }

  let response: Response;
  try {
    response = await fetch(`${WORKER_URL}/process`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(55_000),
      cache: "no-store"
    });
  } catch {
    throw new ProcessingError("The local image worker is unavailable. Start the image-worker service and try again.", 503);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new ProcessingError(payload?.error ?? "The image worker could not process this file.", response.status >= 500 ? 503 : 400);
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  if (contentType.includes("application/json")) {
    const payload = await response.json() as Record<string, unknown>;
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  }

  const output = await response.arrayBuffer();
  return new Response(output, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": response.headers.get("content-disposition") ?? `attachment; filename="${filename(originalName, `${tool}.png`)}"`,
      "Cache-Control": "no-store"
    }
  });
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

    if (WORKER_TOOLS.has(tool)) {
      return await processWithWorker(tool, input, originalName, formData);
    }

    const source = sharp(input, { limitInputPixels: MAX_PIXELS, sequentialRead: true });
    const metadata = await source.metadata();
    if (!metadata.width || !metadata.height || !metadata.format) throw new Error("The file is not a supported image.");

    if (tool === "image-to-base64") {
      const format = metadata.format === "jpeg" ? "jpeg" : metadata.format;
      const mime = MIME_BY_FORMAT[format] ?? "application/octet-stream";
      const encoded = input.toString("base64");
      const data = formData.get("base64Mode") === "raw" ? encoded : `data:${mime};base64,${encoded}`;
      return Response.json({ data, bytes: input.length, format, width: metadata.width, height: metadata.height }, { headers: { "Cache-Control": "no-store" } });
    }

    if (tool === "image-to-pdf" || tool === "screenshot-to-pdf") {
      const pdf = await imagePdf(input, formData);
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
      const resizeMode = formData.get("resizeMode") === "percentage" ? "percentage" : formData.get("resizeMode") === "preset" ? "preset" : "pixels";
      const percentage = safeInteger(formData.get("percentage"), 100, 10, 400);
      const preset = String(formData.get("preset") ?? "social");
      const presetDimensions: Record<string, [number, number]> = { social: [1080, 1080], story: [1080, 1920], thumbnail: [1280, 720] };
      const [presetWidth, presetHeight] = presetDimensions[preset] ?? presetDimensions.social;
      const width = resizeMode === "percentage" ? Math.max(1, Math.round(metadata.width * percentage / 100)) : resizeMode === "preset" ? presetWidth : safeInteger(formData.get("width"), 0, 1, 12_000);
      const height = resizeMode === "percentage" ? Math.max(1, Math.round(metadata.height * percentage / 100)) : resizeMode === "preset" ? presetHeight : safeInteger(formData.get("height"), 0, 1, 12_000);
      if (!width && !height) throw new Error("Enter a target width or height.");
      image = image.resize(width || undefined, height || undefined, { fit: "inside", withoutEnlargement: formData.get("preventEnlargement") !== "false" });
    } else if (tool === "crop") {
      let width = safeInteger(formData.get("width"), metadata.width, 1, metadata.width);
      let height = safeInteger(formData.get("height"), metadata.height, 1, metadata.height);
      const ratio = String(formData.get("ratio") ?? "free");
      const targetRatio: Record<string, number> = { square: 1, landscape: 16 / 9, portrait: 4 / 5 };
      if (targetRatio[ratio]) {
        if (width / height > targetRatio[ratio]) width = Math.max(1, Math.floor(height * targetRatio[ratio]));
        else height = Math.max(1, Math.floor(width / targetRatio[ratio]));
      }
      const left = safeInteger(formData.get("left"), 0, 0, Math.max(0, metadata.width - width));
      const top = safeInteger(formData.get("top"), 0, 0, Math.max(0, metadata.height - height));
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
    const requestedFormat = typeof formData.get("format") === "string" ? String(formData.get("format")) : fallback;
    const format = tool === "convert" || tool === "compress" || tool === "rotate" ? requestedFormat === "auto" ? fallback : formatOf(requestedFormat) : fallback;
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
    const safeMessage = message.length > 180 ? "The image could not be processed. Check its format and size." : message;
    return errorResponse(safeMessage, error instanceof ProcessingError ? error.status : 400);
  }
}
