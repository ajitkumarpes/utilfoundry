"use client";

import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { TOOLS, type ToolId } from "@/lib/tools";
import { NAV_GROUPS } from "@/components/image-tools/navigation";
import { ToolIcon } from "@/components/image-tools/ToolIcon";

type ToolSidebarProps = {
  activeTool: ToolId;
  matchingIds: Set<ToolId>;
  mobileNav: boolean;
  onSelect: (id: ToolId) => void;
  onClose: () => void;
};

export function ToolSidebar({ activeTool, matchingIds, mobileNav, onSelect, onClose }: ToolSidebarProps) {
  return (
    <aside className={`tool-sidebar ${mobileNav ? "open" : ""}`} aria-label="Image tools navigation">
      <div className="sidebar-top">
        <a href="#tools" className="back-link"><ArrowLeft size={16} /> Back to all tools</a>
        <button className="sidebar-close" aria-label="Close tools menu" onClick={onClose}>×</button>
      </div>
      {NAV_GROUPS.map((group) => {
        const visible = group.ids.map((id) => TOOLS.find((item) => item.id === id)).filter((item): item is (typeof TOOLS)[number] => Boolean(item && matchingIds.has(item.id)));
        if (!visible.length) return null;
        return (
          <div className="nav-group" key={group.label}>
            <div className="nav-group-label">{group.label}{group.label === "AI & OCR" && <span className="new-badge">NEW</span>}</div>
            {visible.map((item) => (
              <button key={item.id} className={`nav-tool ${item.id === activeTool ? "active" : ""}`} onClick={() => onSelect(item.id)}>
                <span className="nav-tool-icon"><ToolIcon id={item.id} size={17} /></span>
                <span><strong>{item.name}</strong><small>{item.description.replace(" with local OCR", "").replace(" with a local model", "")}</small></span>
                {item.id === activeTool && <ArrowRight size={14} />}
              </button>
            ))}
          </div>
        );
      })}
      <div className="feature-card"><span className="feature-icon"><Sparkles size={20} /></span><div><strong>Need a feature?</strong><small>Tell us what you need</small></div><ArrowRight size={15} /></div>
    </aside>
  );
}
