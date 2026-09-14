"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FileType, Grid2x2, Layers, Minimize2, Repeat, ShieldCheck } from "lucide-react";
import { TOOL_GROUPS, ToolIconKey } from "@/lib/tools";

const ICONS: Record<ToolIconKey, typeof Layers> = {
  layers: Layers,
  repeat: Repeat,
  file: FileType,
  optimize: Minimize2,
  shield: ShieldCheck
};

const VISIBLE_COUNT = 5;

export default function ToolCatalog() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="group-grid">
      {TOOL_GROUPS.map(group => {
        const Icon = ICONS[group.icon];
        const isExpanded = expanded[group.id];
        const hasMore = group.tools.length > VISIBLE_COUNT;
        const visibleTools = isExpanded ? group.tools : group.tools.slice(0, VISIBLE_COUNT);

        return (
          <section className={`group-card cat-${group.color}`} id={group.id} key={group.id}>
            <div className="group-icon">
              <Icon size={20} aria-hidden="true" />
            </div>
            <h3>{group.title}</h3>
            <p className="group-desc">{group.description}</p>
            <div className="tool-list">
              {visibleTools.map(tool => (
                <Link key={tool.href} href={tool.href}>
                  {tool.name}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              ))}
            </div>
            {hasMore && (
              <button
                type="button"
                className="view-all-btn"
                onClick={() => setExpanded(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                aria-expanded={isExpanded}
              >
                <Grid2x2 size={14} aria-hidden="true" />
                {isExpanded ? "Show fewer tools" : `View all ${group.tools.length} tools`}
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
