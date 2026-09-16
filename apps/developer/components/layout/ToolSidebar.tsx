"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Lightbulb, ShieldCheck, X } from "lucide-react";
import { CONTACT_URL } from "@/lib/links";
import { CATEGORY_ORDER, TOOLS } from "@/lib/tools";
import { ACCENTS, ToolIcon } from "@/components/ui/ToolIcon";

type ToolSidebarProps = { open: boolean; onClose: () => void };

export function ToolSidebar({ open, onClose }: ToolSidebarProps) {
  const pathname = usePathname();
  const activeSlug = pathname.replace(/^\//, "");

  return (
    <aside className={`tool-sidebar ${open ? "is-open" : ""}`} aria-label="Developer tools">
      <div className="sidebar-top">
        <Link className="back-link" href="/"><ArrowLeft size={15} /> All {TOOLS.length} tools</Link>
        <button className="sidebar-close" aria-label="Close tools menu" onClick={onClose}><X size={20} /></button>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const tools = TOOLS.filter((tool) => tool.category === category);
        if (!tools.length) return null;
        return (
          <div className="nav-group" key={category}>
            <p className="nav-group-label">{category}<span className="nav-count">{tools.length}</span></p>
            {tools.map((tool) => {
              const accent = ACCENTS[tool.accent];
              const isActive = tool.slug === activeSlug;
              return (
                <Link
                  key={tool.id}
                  href={`/${tool.slug}`}
                  className="nav-tool"
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

      <div className="sidebar-note">
        <ShieldCheck size={16} aria-hidden />
        <span><b>Private by default</b><small>Nothing leaves your browser</small></span>
      </div>

      {CONTACT_URL && (
        <a href={CONTACT_URL} className="nav-feature" onClick={onClose}>
          <Lightbulb size={22} aria-hidden />
          <span><b>Need a tool?</b><small>Tell us what you need</small></span>
        </a>
      )}
    </aside>
  );
}
