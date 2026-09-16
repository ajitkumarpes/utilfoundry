import Link from "next/link";
import { CheckCircle2, FileText, ImageIcon, Leaf, Lock, Server, ShieldCheck, SlidersHorizontal, Sparkles, Target, Zap } from "lucide-react";
import { TOOL_ACCENT, ToolIcon } from "@/components/ui/ToolIcon";
import type { ToolDefinition } from "@/lib/tools";

/** Picks the chip glyph from its wording, so tool definitions stay plain data. */
function chipIcon(text: string) {
  const value = text.toLowerCase();
  // Checked first: both phrases contain words the broader rules below would catch.
  if (value.includes("no ai")) return { icon: <Leaf size={15} />, color: "var(--green)", tint: "var(--green-tint)" };
  if (value.includes("processed locally")) return { icon: <Server size={15} />, color: "var(--green)", tint: "var(--green-tint)" };
  if (value.includes("free")) return { icon: <ShieldCheck size={15} />, color: "var(--green)", tint: "var(--green-tint)" };
  if (value.includes("account")) return { icon: <Lock size={15} />, color: "var(--blue)", tint: "var(--blue-tint)" };
  if (value.includes("ai") || value.includes("powered")) return { icon: <Sparkles size={15} />, color: "var(--purple)", tint: "var(--purple-tint)" };
  if (value.includes("local") || value.includes("private")) return { icon: <ShieldCheck size={15} />, color: "var(--green)", tint: "var(--green-tint)" };
  if (value.includes("accuracy") || value.includes("language")) return { icon: <Target size={15} />, color: "var(--blue)", tint: "var(--blue-tint)" };
  if (value.includes("fast")) return { icon: <Zap size={15} />, color: "#e8912a", tint: "var(--amber-tint)" };
  if (value.includes("reorder") || value.includes("customiz") || value.includes("mode") || value.includes("style")) {
    return { icon: <SlidersHorizontal size={15} />, color: "var(--blue)", tint: "var(--blue-tint)" };
  }
  if (value.includes("preview") || value.includes("real-time")) return { icon: <CheckCircle2 size={15} />, color: "var(--green)", tint: "var(--green-tint)" };
  if (value.includes("output") || value.includes("quality")) return { icon: <FileText size={15} />, color: "var(--blue)", tint: "var(--blue-tint)" };
  return { icon: <ImageIcon size={15} />, color: "var(--green)", tint: "var(--green-tint)" };
}

/** The honest version of where the pixels go, shown on hover. */
function processingNote(tool: ToolDefinition) {
  if (tool.engine === "worker") return "Processed by the image worker on this server. No third-party service is involved and nothing is stored.";
  if (tool.engine === "server") return "Encoded on this app's own server. No third-party service is involved and nothing is stored.";
  return "Processed in your browser. AVIF and TIFF output is encoded on this server, which keeps nothing.";
}

export function PageHeader({ tool }: { tool: ToolDefinition }) {
  const accent = TOOL_ACCENT[tool.category];
  return (
    <>
      <div className="crumb-row">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">UtilFoundry</Link>
          <span aria-hidden>/</span>
          <Link href="/">Images</Link>
          <span aria-hidden>/</span>
          <span aria-current="page">{tool.name}</span>
        </nav>
        <span className="processing-pill" title={processingNote(tool)}>
          <i aria-hidden />
          {tool.engine === "worker" || tool.engine === "server" ? "Server-local processing" : "Runs in your browser"}
        </span>
      </div>

      <div className="tool-hero">
        <span className="tool-hero-icon" style={{ background: accent.tint, color: accent.color }}>
          <ToolIcon id={tool.id} size={30} strokeWidth={1.8} />
        </span>
        <div>
          <h1>{tool.name}</h1>
          <p>{tool.description}</p>
        </div>
      </div>

      {tool.highlights.length > 0 && (
        <div className="trust-row">
          {tool.highlights.map((item) => {
            const chip = chipIcon(item);
            return (
              <span className="trust-chip" key={item}>
                <i style={{ background: chip.tint, color: chip.color }}>{chip.icon}</i>
                {item}
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}
