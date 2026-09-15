/**
 * Helpers shared by the batch tools (compressor, converter): what to upload
 * for each image, and what to call the results.
 */

import { context, createCanvas } from "@/lib/canvas/effects";
import { canvasToBlob } from "@/lib/canvas/encode";
import type { SourceImage } from "@/lib/canvas/types";
import { baseName } from "@/lib/format";

/** Containers Sharp decodes itself. BMP, ICO and HEIC are not among them. */
const SERVER_READABLE = /^image\/(jpeg|jpg|png|webp|gif|avif|tiff|svg\+xml)$/i;

export const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/tiff": "tiff",
  "image/bmp": "bmp",
  "image/x-icon": "ico"
};

/**
 * The file to send to the server. Anything Sharp cannot read goes as the
 * browser's own lossless decode, so a BMP, an ICO or a Safari-decoded HEIC
 * still works.
 */
export async function serverReadableFile(image: SourceImage): Promise<File> {
  const original = image.file ?? new File([await (await fetch(image.url)).blob()], image.name, { type: image.type });
  if (SERVER_READABLE.test(original.type)) return original;
  const canvas = createCanvas(image.width, image.height);
  context(canvas).drawImage(image.element, 0, 0);
  const png = await canvasToBlob(canvas, "image/png", 100);
  return new File([png], `${baseName(image.name)}.png`, { type: "image/png" });
}

/** "name-suffix.ext", numbered when a batch would otherwise repeat a name. */
export function uniqueName(name: string, suffix: string, extension: string, taken: Set<string>) {
  let candidate = `${baseName(name)}-${suffix}.${extension}`;
  for (let index = 2; taken.has(candidate); index += 1) candidate = `${baseName(name)}-${suffix}-${index}.${extension}`;
  taken.add(candidate);
  return candidate;
}
