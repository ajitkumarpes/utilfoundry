import type { ToolNavGroup } from "@/components/image-tools/types";

export const NAV_GROUPS: ToolNavGroup[] = [
  { label: "OPTIMIZE", ids: ["compress", "resize", "strip-metadata"] },
  { label: "TRANSFORM", ids: ["crop", "rotate", "flip"] },
  { label: "CONVERT", ids: ["convert", "image-to-pdf", "screenshot-to-pdf", "image-to-base64", "base64-to-image"] },
  { label: "AI & OCR", ids: ["remove-background", "upscale", "ocr", "screenshot-to-text"] }
];
