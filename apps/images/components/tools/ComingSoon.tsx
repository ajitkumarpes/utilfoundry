import Link from "next/link";
import { Hammer } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools";

export function ComingSoon({ tool }: { tool: ToolDefinition }) {
  return (
    <section className="card soon-panel">
      <Hammer size={34} strokeWidth={1.5} aria-hidden style={{ color: "var(--accent)" }} />
      <h2>{tool.name} is not built yet</h2>
      <p>
        {tool.description} It is listed here so the navigation reflects the full plan, but nothing
        behind it works yet — no half-finished screen pretending otherwise.
      </p>
      <Link className="btn btn-primary" href="/image-compressor">Use a tool that works</Link>
    </section>
  );
}
