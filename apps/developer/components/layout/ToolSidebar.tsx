"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronDown, Clock3, Lightbulb, Search, ShieldCheck, Star, X } from "lucide-react";
import { CONTACT_URL } from "@/lib/links";
import { CATEGORY_ORDER, TOOLS, getTool, type ToolDefinition } from "@/lib/tools";
import { useCollapsedCategories, useFavorites, useRecents } from "@/lib/tool-prefs";
import { ACCENTS, ToolIcon } from "@/components/ui/ToolIcon";

type ToolSidebarProps = { open: boolean; onClose: () => void };

function ToolRow({ tool, isActive, onClose }: { tool: ToolDefinition; isActive: boolean; onClose: () => void }) {
  const accent = ACCENTS[tool.accent];
  return (
    <Link href={`/${tool.slug}`} className="nav-tool" aria-current={isActive ? "page" : undefined} onClick={onClose}>
      <span className="nav-tool-icon" style={{ color: isActive ? "var(--accent)" : accent.color }}>
        <ToolIcon id={tool.id} size={17} />
      </span>
      <span className="nav-tool-text">
        <span className="nav-tool-label">{tool.name}</span>
        <span className="nav-tool-caption">{tool.tagline}</span>
      </span>
    </Link>
  );
}

export function ToolSidebar({ open, onClose }: ToolSidebarProps) {
  const pathname = usePathname();
  const activeSlug = pathname.replace(/^\//, "");
  const activeTool = getTool(activeSlug);

  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const { favorites } = useFavorites();
  const { recents, record } = useRecents();
  const { collapsed, toggle: toggleCategory } = useCollapsedCategories();

  useEffect(() => {
    if (activeTool) record(activeTool.id);
    // Only the tool actually being viewed should count as a visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlug]);

  // "/" focuses the sidebar filter, unless the user is already typing somewhere else —
  // the header's own ⌘K search covers the "jump straight to a tool" case; this one
  // narrows the list in place instead of navigating.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const isFiltering = normalizedQuery.length > 0;

  const matches = useMemo(() => {
    if (!isFiltering) return null;
    return TOOLS.filter(
      (tool) => tool.name.toLowerCase().includes(normalizedQuery) || tool.tagline.toLowerCase().includes(normalizedQuery)
    );
  }, [isFiltering, normalizedQuery]);

  const favoriteTools = favorites.map((id) => TOOLS.find((tool) => tool.id === id)).filter((tool): tool is ToolDefinition => Boolean(tool));
  const recentTools = recents
    .map((id) => TOOLS.find((tool) => tool.id === id))
    .filter((tool): tool is ToolDefinition => tool != null && tool.id !== activeTool?.id)
    .slice(0, 5);

  return (
    <aside className={`tool-sidebar ${open ? "is-open" : ""}`} aria-label="Developer tools">
      <div className="sidebar-top">
        <Link className="back-link" href="/"><ArrowLeft size={15} /> All {TOOLS.length} tools</Link>
        <button className="sidebar-close" aria-label="Close tools menu" onClick={onClose}><X size={20} /></button>
      </div>

      <label className="sidebar-search">
        <Search size={15} aria-hidden />
        <input
          ref={searchRef}
          type="search"
          placeholder="Search tools…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Filter tools in this list"
        />
        <kbd>/</kbd>
      </label>

      {isFiltering ? (
        <div className="nav-group">
          {matches?.length ? (
            matches.map((tool) => <ToolRow key={tool.id} tool={tool} isActive={tool.slug === activeSlug} onClose={onClose} />)
          ) : (
            <p className="nav-empty">No tools match &ldquo;{query}&rdquo;.</p>
          )}
        </div>
      ) : (
        <>
          {favoriteTools.length > 0 && (
            <div className="nav-group">
              <p className="nav-group-label">
                <Star size={12} aria-hidden /> Favorites
              </p>
              {favoriteTools.map((tool) => (
                <ToolRow key={tool.id} tool={tool} isActive={tool.slug === activeSlug} onClose={onClose} />
              ))}
            </div>
          )}

          {recentTools.length > 0 && (
            <div className="nav-group">
              <p className="nav-group-label">
                <Clock3 size={12} aria-hidden /> Recently used
              </p>
              {recentTools.map((tool) => (
                <ToolRow key={tool.id} tool={tool} isActive={tool.slug === activeSlug} onClose={onClose} />
              ))}
            </div>
          )}

          {CATEGORY_ORDER.map((category) => {
            const tools = TOOLS.filter((tool) => tool.category === category);
            if (!tools.length) return null;
            const isCollapsed = collapsed.includes(category);
            return (
              <div className="nav-group" key={category}>
                <button
                  type="button"
                  className="nav-group-label nav-group-toggle"
                  onClick={() => toggleCategory(category)}
                  aria-expanded={!isCollapsed}
                >
                  <ChevronDown size={13} aria-hidden className={isCollapsed ? "is-collapsed" : ""} />
                  {category}
                  <span className="nav-count">{tools.length}</span>
                </button>
                {!isCollapsed && tools.map((tool) => (
                  <ToolRow key={tool.id} tool={tool} isActive={tool.slug === activeSlug} onClose={onClose} />
                ))}
              </div>
            );
          })}
        </>
      )}

      <div className="sidebar-note">
        <ShieldCheck size={16} aria-hidden />
        <span><b>Private by default</b><small>Nothing leaves your browser</small></span>
      </div>

      <a href={CONTACT_URL} className="nav-feature" onClick={onClose}>
        <Lightbulb size={22} aria-hidden />
        <span><b>Need a tool?</b><small>Tell us what you need</small></span>
      </a>
    </aside>
  );
}
