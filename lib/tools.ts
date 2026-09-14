export type ToolId =
  | "compress"
  | "resize"
  | "crop"
  | "convert"
  | "rotate"
  | "flip"
  | "strip-metadata"
  | "image-to-pdf"
  | "screenshot-to-pdf"
  | "image-to-base64"
  | "base64-to-image";

export type ToolDefinition = {
  id: ToolId;
  name: string;
  description: string;
  category: "Optimize" | "Transform" | "Convert" | "Privacy";
  needsFile: boolean;
  needsBase64: boolean;
  output: "image" | "pdf" | "text";
};

export const TOOLS: ToolDefinition[] = [
  { id: "compress", name: "Image Compressor", description: "Shrink image size with controlled quality.", category: "Optimize", needsFile: true, needsBase64: false, output: "image" },
  { id: "resize", name: "Resize Image", description: "Change dimensions without accidental enlargement.", category: "Transform", needsFile: true, needsBase64: false, output: "image" },
  { id: "crop", name: "Crop Image", description: "Extract an exact pixel rectangle.", category: "Transform", needsFile: true, needsBase64: false, output: "image" },
  { id: "convert", name: "Image Converter", description: "Convert JPG, PNG, WebP and AVIF.", category: "Convert", needsFile: true, needsBase64: false, output: "image" },
  { id: "rotate", name: "Rotate Image", description: "Rotate by 90°, 180° or 270°.", category: "Transform", needsFile: true, needsBase64: false, output: "image" },
  { id: "flip", name: "Flip Image", description: "Flip horizontally or vertically.", category: "Transform", needsFile: true, needsBase64: false, output: "image" },
  { id: "strip-metadata", name: "Remove Metadata", description: "Remove EXIF, GPS and embedded profiles.", category: "Privacy", needsFile: true, needsBase64: false, output: "image" },
  { id: "image-to-pdf", name: "Image to PDF", description: "Create a clean PDF from one image.", category: "Convert", needsFile: true, needsBase64: false, output: "pdf" },
  { id: "screenshot-to-pdf", name: "Screenshot to PDF", description: "Turn a screenshot into a shareable PDF.", category: "Convert", needsFile: true, needsBase64: false, output: "pdf" },
  { id: "image-to-base64", name: "Image to Base64", description: "Create a data URI for HTML or APIs.", category: "Convert", needsFile: true, needsBase64: false, output: "text" },
  { id: "base64-to-image", name: "Base64 to Image", description: "Decode a data URI or raw Base64 payload.", category: "Convert", needsFile: false, needsBase64: true, output: "image" }
];

export const FORMAT_LABELS = ["jpeg", "png", "webp", "avif"] as const;
export type OutputFormat = (typeof FORMAT_LABELS)[number];

export function isToolId(value: string): value is ToolId {
  return TOOLS.some((tool) => tool.id === value);
}

export function safeInteger(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function parseBase64(value: string): { buffer: Buffer; mime?: string } {
  const trimmed = value.trim();
  const match = trimmed.match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/s);
  const encoded = match?.[2] ?? trimmed;
  if (!encoded || encoded.length > 45_000_000 || !/^[a-zA-Z0-9+/=\s]+$/.test(encoded)) {
    throw new Error("Enter a valid Base64 image payload.");
  }
  const normalized = encoded.replace(/\s/g, "");
  const buffer = Buffer.from(normalized, "base64");
  if (!buffer.length || buffer.length > 32 * 1024 * 1024) throw new Error("The decoded image must be between 1 byte and 32 MB.");
  return { buffer, mime: match?.[1] };
}
