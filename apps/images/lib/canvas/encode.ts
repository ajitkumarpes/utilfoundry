import type { EncodeFormat } from "@/lib/canvas/types";

/** Formats the browser can encode itself. Anything else falls back to the server. */
export const CANVAS_FORMATS: Record<string, EncodeFormat> = {
  png: "image/png",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  webp: "image/webp"
};

export const SERVER_ONLY_FORMATS = new Set(["avif", "tiff", "gif", "bmp"]);

export const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/tiff": "tiff",
  "application/pdf": "pdf"
};

export function canvasToBlob(canvas: HTMLCanvasElement, type: EncodeFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("The browser could not encode this image.")),
      type,
      type === "image/png" ? undefined : Math.min(1, Math.max(0.05, quality / 100))
    );
  });
}

/** Encodes in the browser when possible, otherwise re-encodes through Sharp. */
export async function encodeCanvas(canvas: HTMLCanvasElement, format: string, quality: number): Promise<{ blob: Blob; extension: string }> {
  const canvasType = CANVAS_FORMATS[format];
  if (canvasType) {
    const blob = await canvasToBlob(canvas, canvasType, quality);
    return { blob, extension: EXTENSION[canvasType] };
  }

  // AVIF and TIFF have no browser encoder, so the losslessly encoded PNG is
  // handed to the server, which re-encodes it with libvips.
  const png = await canvasToBlob(canvas, "image/png", 100);
  const body = new FormData();
  body.append("tool", "image-converter");
  body.append("file", new File([png], "frame.png", { type: "image/png" }));
  body.append("format", format);
  body.append("quality", String(quality));

  const response = await fetch("/api/process", { method: "POST", body });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `The server could not encode this image as ${format.toUpperCase()}.`);
  }
  return { blob: await response.blob(), extension: format === "jpeg" ? "jpg" : format };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
