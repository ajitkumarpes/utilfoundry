import type { SourceImage } from "@/lib/canvas/types";

export const MAX_FILE_BYTES = 32 * 1024 * 1024;

const SUPPORTED = /^image\/(jpeg|jpg|png|webp|gif|bmp|tiff|avif|heic|heif|x-icon|svg\+xml)$/i;

export function isSupportedImage(file: File) {
  return SUPPORTED.test(file.type) || /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|hei[cf]|ico|svg)$/i.test(file.name);
}

/**
 * Loads an image through its `load` event. Unlike `HTMLImageElement.decode()`,
 * this settles even when the tab is in the background.
 */
export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const element = new Image();
    element.crossOrigin = "anonymous";
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("This file could not be decoded as an image by your browser."));
    element.src = url;
  });
}

let counter = 0;
function nextId() {
  counter += 1;
  return `img-${Date.now().toString(36)}-${counter}`;
}

export async function loadFile(file: File): Promise<SourceImage> {
  if (!isSupportedImage(file)) throw new Error(`“${file.name}” is not a supported image format.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`“${file.name}” is larger than 32 MB.`);
  const url = URL.createObjectURL(file);
  try {
    const element = await loadImageElement(url);
    return {
      id: nextId(),
      name: file.name,
      size: file.size,
      type: file.type || "image/*",
      url,
      width: element.naturalWidth,
      height: element.naturalHeight,
      element,
      file
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function loadSample(src: string, name: string): Promise<SourceImage> {
  const response = await fetch(src, { cache: "force-cache" });
  if (!response.ok) throw new Error("The sample image could not be loaded.");
  const blob = await response.blob();
  const file = new File([blob], name, { type: blob.type || "image/jpeg" });
  return loadFile(file);
}

export function releaseImage(image: SourceImage | null | undefined) {
  if (image?.url.startsWith("blob:")) URL.revokeObjectURL(image.url);
}
