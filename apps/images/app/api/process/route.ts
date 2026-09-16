import { PDFDocument } from "pdf-lib";
import sharp, { type FormatEnum, type Sharp } from "sharp";
import { isToolId, parseBase64, safeInteger, type ToolId } from "@/lib/tools";
import { imagePdf } from "@/lib/server-pdf";
import { ProcessingError } from "@/lib/errors";
import { clientKey, GENERAL_LIMIT, SlidingWindow, WORKER_LIMIT } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_INPUT_BYTES = 32 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const WORKER_URL = process.env.IMAGE_WORKER_URL ?? "http://127.0.0.1:8094";

/** Tool slug → the name the Python worker expects. */
const WORKER_TOOLS: Partial<Record<ToolId, string>> = {
  "ocr-image": "ocr",
  "screenshot-to-text": "screenshot-to-text",
  "background-removal": "remove-background",
  "image-upscaler": "upscale"
};

export type ServerFormat = "jpeg" | "png" | "webp" | "avif" | "tiff";
const SERVER_FORMATS: ServerFormat[] = ["jpeg", "png", "webp", "avif", "tiff"];

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

/** Module scope, so the counts survive between requests to the same running server. */
const generalWindow = new SlidingWindow(GENERAL_LIMIT);
const workerWindow = new SlidingWindow(WORKER_LIMIT);

function errorResponse(message: string, status = 400, extra: Record<string, string> = {}) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

function filename(value: string | undefined, suffix: string) {
  const clean = (value ?? "image").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
  return `${clean.replace(/\.[^.]+$/, "")}-${suffix}`;
}

function binaryResponse(body: Uint8Array, mime: string, name: string, extra: Record<string, string> = {}) {
  return new Response(body as unknown as BodyInit, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
      ...extra
    }
  });
}

function readFiles(formData: FormData) {
  const files = formData.getAll("file").filter((entry): entry is File => entry instanceof File);
  if (!files.length) throw new ProcessingError("Choose an image file first.");
  for (const file of files) {
    if (!file.size || file.size > MAX_INPUT_BYTES) {
      throw new ProcessingError(`“${file.name}” must be between 1 byte and 32 MB.`);
    }
  }
  return files;
}

function formatOf(value: string | null | undefined, fallback: ServerFormat): ServerFormat {
  if (!value || value === "auto") return fallback;
  return SERVER_FORMATS.includes(value as ServerFormat) ? value as ServerFormat : fallback;
}

async function encode(image: Sharp, format: ServerFormat, quality: number) {
  const options: Record<string, unknown> = format === "jpeg"
    ? { quality, mozjpeg: true }
    : format === "png"
      ? { compressionLevel: 9, adaptiveFiltering: true }
      : format === "tiff"
        ? { quality, compression: "deflate" }
        : { quality, effort: 4 };
  return image.toFormat(format as keyof FormatEnum, options).toBuffer();
}

type CompressFormat = "jpeg" | "png" | "webp" | "avif" | "gif" | "tiff";
const COMPRESS_TARGETS = new Set<string>(["jpeg", "png", "webp", "avif"]);
/** Sources the compressor can write back in their own format. */
const COMPRESS_KEEPS = new Set<string>(["jpeg", "png", "webp", "avif", "gif", "tiff"]);

/** Encoder settings that trade quality for size, per format. */
function compressOptions(format: CompressFormat, quality: number): Record<string, unknown> {
  switch (format) {
    case "jpeg": return { quality, mozjpeg: true };
    // Palette quantisation is what makes PNGs small; at 100 the file stays lossless.
    case "png": return quality >= 100
      ? { compressionLevel: 9, adaptiveFiltering: true, effort: 10 }
      : { palette: true, quality, effort: 8, compressionLevel: 9, dither: 1 };
    case "webp": return { quality, effort: 5, smartSubsample: true };
    // AVIF's scale runs lower than JPEG's for the same look; 78 maps to about 59.
    case "avif": return { quality: Math.max(1, Math.round(quality * 0.75)), effort: 4 };
    case "gif": return {
      effort: 7,
      dither: 1,
      colours: quality >= 90 ? 256 : quality >= 70 ? 128 : quality >= 50 ? 64 : 32,
      interFrameMaxError: quality >= 90 ? 0 : 6
    };
    case "tiff": return { compression: "deflate", predictor: "horizontal" };
  }
}

/**
 * The compressor: re-encode for size, never for looks. Returns the original
 * bytes (flagged `X-Compression: original`) when the same format would only
 * come out bigger.
 */
async function compress(input: Buffer, formData: FormData, originalName: string) {
  const probe = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
  if (!probe.width || !probe.height || !probe.format) throw new ProcessingError("The file is not a supported image.");

  // Sharp reports AVIF as "heif", since AVIF is a HEIF-family container.
  const source = probe.format === "heif" ? "avif" : String(probe.format);
  const animated = (probe.pages ?? 1) > 1 && (source === "gif" || source === "webp");
  const quality = safeInteger(formData.get("quality"), 78, 5, 100);
  const requested = String(formData.get("format") ?? "auto");
  const keepOriginal = formData.get("keepFormat") !== "false";
  const format = (COMPRESS_TARGETS.has(requested) ? requested
    : keepOriginal && COMPRESS_KEEPS.has(source) ? source : "webp") as CompressFormat;

  // The output carries no metadata, so the EXIF orientation is applied to the
  // pixels; otherwise a phone photo stored sideways would come out sideways.
  const image = sharp(input, { limitInputPixels: MAX_PIXELS, animated }).rotate();
  const output = await image.toFormat(format as keyof FormatEnum, compressOptions(format, quality)).toBuffer();

  const kept = format === source && output.length >= input.length;
  const turned = (probe.orientation ?? 1) >= 5;
  const height = animated ? probe.pageHeight ?? probe.height : probe.height;
  const extension = format === "jpeg" ? "jpg" : format;
  return binaryResponse(
    new Uint8Array(kept ? input : output),
    MIME_BY_FORMAT[format],
    filename(originalName, `compressed.${extension}`),
    {
      "X-Compression": kept ? "original" : "compressed",
      "X-Image-Width": String(turned ? height : probe.width),
      "X-Image-Height": String(turned ? probe.width : height)
    }
  );
}

async function processWithWorker(tool: ToolId, input: Buffer, originalName: string, formData: FormData) {
  const workerTool = WORKER_TOOLS[tool];
  if (!workerTool) throw new ProcessingError("Unknown image worker operation.");

  const body = new FormData();
  body.append("tool", workerTool);
  const bytes = new Uint8Array(input.byteLength);
  bytes.set(input);
  body.append("file", new Blob([bytes]), originalName);

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
    throw new ProcessingError(
      payload?.error ?? "The image worker could not process this file.",
      response.status >= 500 ? 503 : 400
    );
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  if (contentType.includes("application/json")) {
    const payload = await response.json() as Record<string, unknown>;
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  }

  return new Response(await response.arrayBuffer(), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": response.headers.get("content-disposition")
        ?? `attachment; filename="${filename(originalName, `${tool}.png`)}"`,
      "Cache-Control": "no-store"
    }
  });
}

const CONVERT_TARGETS = new Set<string>(["jpeg", "png", "webp", "avif", "tiff", "gif"]);

/** Conversion keeps quality: PNG stays lossless and GIF keeps a full palette. */
function convertOptions(format: CompressFormat, quality: number): Record<string, unknown> {
  if (format === "png") return { compressionLevel: 9, adaptiveFiltering: true };
  if (format === "gif") return { effort: 7, dither: 1, colours: 256 };
  return compressOptions(format, quality);
}

/**
 * The converter: any readable input to JPEG, PNG, WebP, AVIF, TIFF or GIF,
 * with an optional resize. Animation survives into GIF and WebP. BMP and ICO
 * are wrapped in the browser from the PNG this returns.
 */
async function convert(input: Buffer, formData: FormData, originalName: string) {
  const probe = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
  if (!probe.width || !probe.height || !probe.format) throw new ProcessingError("The file is not a supported image.");

  const source = probe.format === "heif" ? "avif" : String(probe.format);
  const requested = String(formData.get("format") ?? "auto");
  const format = (CONVERT_TARGETS.has(requested) ? requested : CONVERT_TARGETS.has(source) ? source : "png") as CompressFormat;
  const quality = safeInteger(formData.get("quality"), 90, 5, 100);
  const animated = (probe.pages ?? 1) > 1 && (format === "gif" || format === "webp");

  let image = sharp(input, { limitInputPixels: MAX_PIXELS, animated }).rotate();
  const width = safeInteger(formData.get("width"), 0, 0, 12_000);
  const height = safeInteger(formData.get("height"), 0, 0, 12_000);
  if (width || height) {
    image = image.resize(width || undefined, height || undefined, {
      fit: formData.get("keepAspect") === "false" && width && height ? "fill" : "inside",
      withoutEnlargement: formData.get("allowEnlargement") !== "true"
    });
  }
  // JPEG has no alpha channel: transparent areas become white rather than black.
  if (format === "jpeg") image = image.flatten({ background: "#ffffff" });

  const { data, info } = await image
    .toFormat(format as keyof FormatEnum, convertOptions(format, quality))
    .toBuffer({ resolveWithObject: true });
  const extension = format === "jpeg" ? "jpg" : format;
  return binaryResponse(new Uint8Array(data), MIME_BY_FORMAT[format], filename(originalName, `converted.${extension}`), {
    "X-Image-Width": String(info.width),
    "X-Image-Height": String(animated ? info.pageHeight ?? info.height : info.height)
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const rawTool = formData.get("tool");
    const tool = typeof rawTool === "string" ? rawTool : "";
    if (!isToolId(tool)) return errorResponse("Unknown image operation.");

    const caller = clientKey(request);
    const general = generalWindow.take(caller);
    if (!general.allowed) {
      return errorResponse(
        "Too many requests from this connection. Wait a moment and try again.",
        429,
        { "Retry-After": String(general.retryAfterSeconds) }
      );
    }
    if (WORKER_TOOLS[tool]) {
      const worker = workerWindow.take(caller);
      if (!worker.allowed) {
        return errorResponse(
          "The OCR and model tools are limited to a few runs a minute. Wait a moment and try again.",
          429,
          { "Retry-After": String(worker.retryAfterSeconds) }
        );
      }
    }

    if (tool === "base64-to-image") {
      const value = formData.get("base64");
      if (typeof value !== "string") return errorResponse("Paste a Base64 image payload first.");
      const { buffer } = parseBase64(value);
      const output = await sharp(buffer, { limitInputPixels: MAX_PIXELS }).png().toBuffer();
      return binaryResponse(new Uint8Array(output), MIME_BY_FORMAT.png, filename("decoded", "image.png"));
    }

    const files = readFiles(formData);
    const primary = files[0];
    const input = Buffer.from(await primary.arrayBuffer());
    const originalName = primary.name;

    if (WORKER_TOOLS[tool]) {
      return await processWithWorker(tool, input, originalName, formData);
    }

    if (tool === "image-compressor") return await compress(input, formData, originalName);
    if (tool === "image-converter") return await convert(input, formData, originalName);

    if (tool === "image-to-pdf" || tool === "screenshot-to-pdf") {
      const buffers = await Promise.all(
        files.map(async (file) => ({ buffer: Buffer.from(await file.arrayBuffer()), name: file.name }))
      );
      const pdf = await imagePdf(buffers, formData);
      return binaryResponse(new Uint8Array(pdf), MIME_BY_FORMAT.pdf, filename(originalName, "converted.pdf"));
    }

    const source = sharp(input, { limitInputPixels: MAX_PIXELS, sequentialRead: true });
    const metadata = await source.metadata();
    if (!metadata.width || !metadata.height || !metadata.format) {
      throw new ProcessingError("The file is not a supported image.");
    }

    if (tool === "image-to-base64") {
      const format = metadata.format === "heif" ? "avif" : metadata.format;
      const mime = MIME_BY_FORMAT[format] ?? "application/octet-stream";
      const encoded = input.toString("base64");
      const data = formData.get("base64Mode") === "raw" ? encoded : `data:${mime};base64,${encoded}`;
      return Response.json(
        { data, bytes: input.length, format, width: metadata.width, height: metadata.height },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    let image = source;
    const quality = safeInteger(formData.get("quality"), 90, 5, 100);

    if (tool === "resize-image") {
      const resizeMode = String(formData.get("resizeMode") ?? "pixels");
      const presets: Record<string, [number, number]> = {
        social: [1080, 1080], story: [1080, 1920], thumbnail: [1280, 720], hd: [1920, 1080], "4k": [3840, 2160]
      };
      let width: number;
      let height: number;
      if (resizeMode === "percentage") {
        const percentage = safeInteger(formData.get("percentage"), 100, 10, 400);
        width = Math.max(1, Math.round(metadata.width * percentage / 100));
        height = Math.max(1, Math.round(metadata.height * percentage / 100));
      } else if (resizeMode === "preset") {
        [width, height] = presets[String(formData.get("preset") ?? "social")] ?? presets.social;
      } else {
        width = safeInteger(formData.get("width"), 0, 1, 12_000);
        height = safeInteger(formData.get("height"), 0, 1, 12_000);
      }
      if (!width && !height) throw new ProcessingError("Enter a target width or height.");
      image = image.resize(width || undefined, height || undefined, {
        fit: "inside",
        withoutEnlargement: formData.get("preventEnlargement") !== "false"
      });
    } else if (tool === "crop-image") {
      const ratios: Record<string, number> = { square: 1, landscape: 16 / 9, portrait: 4 / 5, classic: 4 / 3 };
      let width = safeInteger(formData.get("cropWidth"), metadata.width, 1, metadata.width);
      let height = safeInteger(formData.get("cropHeight"), metadata.height, 1, metadata.height);
      const ratio = ratios[String(formData.get("ratio") ?? "free")];
      if (ratio) {
        if (width / height > ratio) width = Math.max(1, Math.floor(height * ratio));
        else height = Math.max(1, Math.floor(width / ratio));
      }
      const left = safeInteger(formData.get("left"), 0, 0, Math.max(0, metadata.width - width));
      const top = safeInteger(formData.get("top"), 0, 0, Math.max(0, metadata.height - height));
      image = image.extract({ left, top, width, height });
    } else if (tool === "rotate-image") {
      const angle = Number(formData.get("angle"));
      if (![90, 180, 270].includes(angle)) throw new ProcessingError("Choose a 90°, 180° or 270° rotation.");
      image = image.rotate(angle);
    } else if (tool === "flip-image") {
      const direction = formData.get("direction");
      if (direction === "vertical") image = image.flip();
      else if (direction === "horizontal") image = image.flop();
      else throw new ProcessingError("Choose a flip direction.");
    } else if (tool === "grayscale-image") {
      image = image.grayscale();
    } else if (tool === "blur-image") {
      const intensity = safeInteger(formData.get("intensity"), 10, 1, 60);
      image = image.blur(intensity);
    } else if (tool === "sharpen-image") {
      const intensity = safeInteger(formData.get("intensity"), 50, 1, 100);
      image = image.sharpen({ sigma: 0.6 + (intensity / 100) * 2.4 });
    }
    // remove-metadata changes only the encoding: Sharp drops EXIF on
    // re-encode, which is the whole operation.

    // Sharp reports AVIF as "heif", since AVIF is a HEIF-family container.
    const sourceFormat: ServerFormat = metadata.format === "png" ? "png"
      : metadata.format === "webp" ? "webp"
        : metadata.format === "heif" ? "avif"
          : metadata.format === "tiff" ? "tiff" : "jpeg";
    const requested = formData.get("format");
    const format = formatOf(typeof requested === "string" ? requested : null, sourceFormat);
    const output = await encode(image, format, quality);

    return binaryResponse(
      new Uint8Array(output),
      MIME_BY_FORMAT[format],
      filename(originalName, `${tool}.${format === "jpeg" ? "jpg" : format}`),
      { "X-Image-Width": String(metadata.width), "X-Image-Height": String(metadata.height) }
    );
  } catch (error) {
    if (error instanceof ProcessingError) return errorResponse(error.message, error.status);
    const message = error instanceof Error ? error.message : "Image processing failed.";
    const safeMessage = message.length > 180 ? "The image could not be processed. Check its format and size." : message;
    return errorResponse(safeMessage, 400);
  }
}
