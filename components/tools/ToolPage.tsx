import { PageHeader } from "@/components/ui/PageHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CanvasWorkbench } from "@/components/tools/CanvasWorkbench";
import { PdfWorkbench } from "@/components/tools/PdfWorkbench";
import { WorkerWorkbench } from "@/components/tools/WorkerWorkbench";
import { Base64ToImage, ImageToBase64 } from "@/components/tools/Base64Workbench";
import { ColorPickerWorkbench, PaletteWorkbench } from "@/components/tools/ColorWorkbench";
import { CompareWorkbench } from "@/components/tools/CompareWorkbench";
import { ComposeWorkbench } from "@/components/tools/ComposeWorkbench";
import { FaviconWorkbench } from "@/components/tools/FaviconWorkbench";
import { FramesWorkbench } from "@/components/tools/FramesWorkbench";
import { InspectWorkbench } from "@/components/tools/InspectWorkbench";
import { ComingSoon } from "@/components/tools/ComingSoon";
import { CompressorWorkbench } from "@/components/tools/CompressorWorkbench";
import { ConverterWorkbench } from "@/components/tools/ConverterWorkbench";
import { CropWorkbench } from "@/components/tools/CropWorkbench";
import { MetadataWorkbench } from "@/components/tools/MetadataWorkbench";
import { FlipWorkbench, RotateWorkbench } from "@/components/tools/OrientWorkbench";
import { ResizeWorkbench } from "@/components/tools/ResizeWorkbench";
import type { ToolDefinition } from "@/lib/tools";

function Workbench({ tool }: { tool: ToolDefinition }) {
  if (tool.comingSoon) return <ComingSoon tool={tool} />;
  if (tool.id === "image-compressor") return <CompressorWorkbench tool={tool} />;
  if (tool.id === "image-converter") return <ConverterWorkbench tool={tool} />;
  if (tool.id === "crop-image") return <CropWorkbench tool={tool} />;
  if (tool.id === "rotate-image") return <RotateWorkbench tool={tool} />;
  if (tool.id === "flip-image") return <FlipWorkbench tool={tool} />;
  if (tool.id === "resize-image") return <ResizeWorkbench tool={tool} />;
  if (tool.id === "remove-metadata") return <MetadataWorkbench tool={tool} />;
  if (tool.id === "image-to-base64") return <ImageToBase64 tool={tool} />;
  if (tool.id === "base64-to-image") return <Base64ToImage tool={tool} />;
  if (tool.id === "color-picker") return <ColorPickerWorkbench tool={tool} />;
  if (tool.id === "color-palette-extractor") return <PaletteWorkbench tool={tool} />;

  switch (tool.engine) {
    case "pdf": return <PdfWorkbench tool={tool} />;
    case "worker": return <WorkerWorkbench tool={tool} />;
    case "inspect": return <InspectWorkbench tool={tool} />;
    case "diff": return <CompareWorkbench tool={tool} />;
    case "compose": return <ComposeWorkbench tool={tool} />;
    case "favicon": return <FaviconWorkbench tool={tool} />;
    case "frames": return <FramesWorkbench tool={tool} />;
    default: return <CanvasWorkbench tool={tool} />;
  }
}

export function ToolPage({ tool }: { tool: ToolDefinition }) {
  return (
    <div className="page-inner">
      <PageHeader tool={tool} />
      <Workbench tool={tool} />
      <SiteFooter />
    </div>
  );
}
