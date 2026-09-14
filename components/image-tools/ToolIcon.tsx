import {
  Crop,
  FileImage,
  FileOutput,
  FlipHorizontal2,
  ImageIcon,
  RotateCw,
  ScanLine,
  ShieldCheck,
  WandSparkles
} from "lucide-react";
import type { ToolId } from "@/lib/tools";

export function ToolIcon({ id, size = 18 }: { id: ToolId; size?: number }) {
  if (id === "rotate") return <RotateCw size={size} />;
  if (id === "flip") return <FlipHorizontal2 size={size} />;
  if (id === "crop") return <Crop size={size} />;
  if (id === "image-to-pdf" || id === "screenshot-to-pdf") return <FileOutput size={size} />;
  if (id === "ocr" || id === "screenshot-to-text") return <ScanLine size={size} />;
  if (id === "remove-background" || id === "upscale") return <WandSparkles size={size} />;
  if (id === "strip-metadata") return <ShieldCheck size={size} />;
  if (id === "base64-to-image" || id === "image-to-base64") return <FileImage size={size} />;
  return <ImageIcon size={size} />;
}
