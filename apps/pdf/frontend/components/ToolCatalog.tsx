"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileType, Layers, Minimize2, Repeat, Search, ShieldCheck } from "lucide-react";
import { TOOL_GROUPS, ToolIconKey } from "@/lib/tools";

const ICONS: Record<ToolIconKey, typeof Layers> = {
  layers: Layers,
  repeat: Repeat,
  file: FileType,
  optimize: Minimize2,
  shield: ShieldCheck
};

export default function ToolCatalog() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      TOOL_GROUPS.map(group => ({
        ...group,
        tools: normalized
          ? group.tools.filter(tool => tool.name.toLowerCase().includes(normalized))
          : group.tools
      })).filter(group => group.tools.length > 0),
    [normalized]
  );

  return (
    <>
      <label className="tool-search">
        <Search size={19} aria-hidden="true" />
        <span className="sr-only">Search PDF tools</span>
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search 36 PDF tools…"
        />
      </label>
      {groups.length ? (
        <div className="group-grid" aria-live="polite">
          {groups.map(group => {
            const Icon = ICONS[group.icon];
            return (
              <section className="group-card" id={group.id} key={group.id}>
                <div className="group-icon"><Icon size={20} aria-hidden="true" /></div>
                <h3>{group.title}</h3>
                <div className="tool-list">
                  {group.tools.map(tool => (
                    <Link key={tool.name} href={tool.href}>
                      {tool.name}<ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="empty-search" role="status">No tools match “{query}”.</p>
      )}
    </>
  );
}
