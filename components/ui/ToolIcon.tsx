import {
  AlignJustify, ArrowRightLeft, CircleDashed, CircleDot, Code2, Columns2, Contrast, Crop,
  Expand, FileImage, FileText, Film, FlipHorizontal2, Frame, Grid2x2, ImageDown, ImageIcon,
  Info, LayoutGrid, Palette, Pipette, RotateCw, Ruler, Scaling, ScanLine, ScanText, Scissors,
  Square, Stamp, Star, Triangle, type LucideIcon
} from "lucide-react";
import type { ToolId } from "@/lib/tools";

const ICONS: Record<ToolId, LucideIcon> = {
  "image-compressor": ImageDown,
  "resize-image": Scaling,
  "remove-metadata": CircleDot,
  "crop-image": Crop,
  "rotate-image": RotateCw,
  "flip-image": FlipHorizontal2,
  "watermark-image": Stamp,
  "add-border": Square,
  "rounded-corners": Frame,
  "grayscale-image": Contrast,
  "sharpen-image": Triangle,
  "blur-image": CircleDashed,
  "image-converter": ArrowRightLeft,
  "image-to-pdf": FileText,
  "screenshot-to-pdf": FileImage,
  "image-to-base64": Code2,
  "base64-to-image": ImageIcon,
  "favicon-generator": Star,
  "gif-to-frames": Film,
  "background-removal": Scissors,
  "image-upscaler": Expand,
  "ocr-image": ScanText,
  "screenshot-to-text": ScanLine,
  "image-metadata-viewer": Info,
  "image-dimensions": Ruler,
  "image-compare": Columns2,
  "color-picker": Pipette,
  "color-palette-extractor": Palette,
  "contact-sheet": LayoutGrid,
  "image-collage": Grid2x2
};

/** Per-category accent, used for the sidebar glyph and the page hero tile. */
export const TOOL_ACCENT: Record<string, { color: string; tint: string }> = {
  Optimize: { color: "#f04e23", tint: "var(--accent-tint)" },
  Transform: { color: "#7c4dee", tint: "var(--purple-tint)" },
  Convert: { color: "#f04e23", tint: "var(--accent-tint)" },
  "AI & OCR": { color: "#7c4dee", tint: "var(--purple-tint)" },
  Utility: { color: "#16a34a", tint: "var(--green-tint)" }
};

export function ToolIcon({ id, size = 18, strokeWidth = 1.9 }: { id: ToolId; size?: number; strokeWidth?: number }) {
  const Icon = ICONS[id] ?? AlignJustify;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden />;
}
