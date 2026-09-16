"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, Lightbulb, X } from "lucide-react";
import { CONTACT_URL } from "@/lib/links";
import { NAV_GROUPS, TOOLS } from "@/lib/tools";
import { TOOL_ACCENT, ToolIcon } from "@/components/ui/ToolIcon";

type ToolSidebarProps = { open: boolean; onClose: () => void };

export function ToolSidebar({ open, onClose }: ToolSidebarProps) {
  const pathname = usePathname();
  const activeId = pathname.replace(/^\//, "");

  return (
    <aside className={`tool-sidebar ${open ? "is-open" : ""}`} aria-label="Image tools">
      <div className="sidebar-top">
        <Link className="back-link" href="/"><ArrowLeft size={15} /> Back to all tools</Link>
        <button className="sidebar-close" aria-label="Close tools menu" onClick={onClose}><X size={20} /></button>
      </div>

      {NAV_GROUPS.map((group) => {
        const tools = TOOLS.filter((tool) => tool.category === group.category);
        if (!tools.length) return null;
        return (
          <div className="nav-group" key={group.label}>
            <p className="nav-group-label">{group.label}{group.category === "AI & OCR" && <span className="nav-new">New</span>}</p>
            {tools.map((tool) => {
              const accent = TOOL_ACCENT[tool.category];
              const isActive = tool.id === activeId;
              return (
                <Link
                  key={tool.id}
                  href={`/${tool.id}`}
                  className={`nav-tool ${tool.comingSoon ? "is-soon" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={onClose}
                >
                  <span className="nav-tool-icon" style={{ color: isActive ? "var(--accent)" : accent.color }}>
                    <ToolIcon id={tool.id} size={17} />
                  </span>
                  <span className="nav-tool-text">
                    <span className="nav-tool-label">{tool.name}</span>
                    <span className="nav-tool-caption">{tool.tagline}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        );
      })}

      {CONTACT_URL && (
        <a href={CONTACT_URL} className="nav-feature" onClick={onClose}>
          <Lightbulb size={22} aria-hidden />
          <span>
            <b>Need a feature?</b>
            <small>Tell us what you need <ArrowRight size={12} aria-hidden /></small>
          </span>
        </a>
      )}
    </aside>
  );
}
