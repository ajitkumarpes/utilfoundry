import type { ToolOptions } from "@/lib/canvas/types";
import type { ToolId } from "@/lib/tools";

/** Starting values for each tool's option rail, mirroring the reference screens. */
export const TOOL_DEFAULTS: Partial<Record<ToolId, ToolOptions>> = {
  "watermark-image": {
    mode: "text", text: "UtilFoundry", font: "inter", fontSize: 72, textColor: "#FFFFFF",
    opacity: 50, position: "middle-center", rotation: -30, shadow: true, outline: false,
    outlineColor: "#111C3D", logoSize: 25, format: "png", quality: 92
  },
  "add-border": {
    borderStyle: "solid", borderColor: "#3B82F6", thickness: 20, cornerStyle: "square",
    changeOutputSize: true, format: "png", quality: 92
  },
  "rounded-corners": {
    radius: 32, cornerStyle: "all", background: "transparent", backgroundColor: "#FFFFFF",
    format: "png", quality: 92
  },
  "grayscale-image": { mode: "desaturate", brightness: 0, contrast: 0, keepSize: true, format: "png", quality: 92 },
  "sharpen-image": { intensity: 50, reduceNoise: true, preserveColors: true, enhanceEdges: true, format: "png", quality: 92 },
  "blur-image": { blurType: "gaussian", intensity: 10, keepSize: true, wholeImage: true, format: "png", quality: 92 },
  "image-to-pdf": {
    pageSize: "a4", orientation: "portrait", fit: "fit", margin: 10,
    pageNumbers: false, mergeToOnePage: false, order: "selected", captions: false, timestamp: false
  },
  "screenshot-to-pdf": {
    pageSize: "original", orientation: "portrait", fit: "fit", margin: 0,
    pageNumbers: false, mergeToOnePage: false, order: "selected", captions: false, timestamp: false
  },
  "background-removal": { format: "png", quality: 90, outputSize: "original" },
  "image-upscaler": { scale: "2", format: "png", quality: 92 },
  "ocr-image": { language: "auto", psm: "6", preserveFormatting: true },
  "screenshot-to-text": { language: "auto", psm: "11", preserveFormatting: true },
  "favicon-generator": { appName: "My Site", themeColor: "#111827", backgroundColor: "#FFFFFF", padding: 0, roundCorners: false, includeIco: true, includeApple: true, includeAndroid: true, includeManifest: true },
  "gif-to-frames": { extractMode: "all", nth: 2, rangeFrom: 1, rangeTo: 1, format: "png", quality: 92, keepOriginalSize: true, frameWidth: 0 },
  "image-metadata-viewer": { tab: "exif" },
  "image-dimensions": {},
  "image-compare": { view: "difference", sensitivity: 75, opacity: 50 },
  "color-picker": { notation: "hex", zoom: 100, showGrid: false },
  "color-palette-extractor": { swatches: 10, notation: "hex", sortBy: "share" },
  "contact-sheet": {
    columns: 4, spacing: 10, sheetWidth: "1600", background: "#FFFFFF", transparent: false,
    showFilenames: true, labelPosition: "below", fontSize: 12, fit: "fit", radius: 0,
    shadow: false, format: "png", quality: 92
  },
  "image-collage": {
    layout: "grid", gap: 12, sheetWidth: "1600", background: "#FFFFFF", transparent: false,
    radius: 12, shadow: false, fit: "fill", showFilenames: false, format: "png", quality: 92
  }
};

export function defaultsFor(tool: ToolId): ToolOptions {
  return { ...(TOOL_DEFAULTS[tool] ?? {}) };
}
