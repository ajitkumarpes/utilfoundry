"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, History, House, LayoutGrid, Search, SquarePlus, Star, X } from "lucide-react";
import { PARENT_URL } from "@/lib/links";
import { CATEGORY_ORDER, TOOLS, getTool, getToolById, type ToolDefinition } from "@/lib/tools";
import { useCollapsedCategories, useFavorites, useRecents } from "@/lib/tool-prefs";
import { ACCENTS, ToolIcon } from "@/components/ui/ToolIcon";
import { openFeedback } from "@/components/FeedbackWidget";

type ToolSidebarProps = { open: boolean; onClose: () => void };
type View = "all" | "favorites" | "recent" | null;

function ToolRow({ tool, isActive, onClose }: { tool: ToolDefinition; isActive: boolean; onClose: () => void }) {
  return (
    <Link
      href={`/${tool.slug}`}
      className="nav-tool"
      aria-current={isActive ? "page" : undefined}
      title={tool.tagline}
      onClick={onClose}
    >
      <span className="nav-tool-icon" style={{ color: isActive ? undefined : ACCENTS[tool.accent].color }}>
        <ToolIcon id={tool.id} size={18} />
      </span>
      <span className="nav-tool-label">{tool.name}</span>
    </Link>
  );
}

function PrimaryNav({ view, favoriteCount, recentCount, onClose }: {
  view: View; favoriteCount: number; recentCount: number; onClose: () => void;
}) {
  const current = (name: View) => (view === name ? "page" : undefined);
  return (
    <nav className="nav-primary" aria-label="Browse tools">
      <a href={PARENT_URL} className="nav-link" onClick={onClose}>
        <House size={19} className="nav-link-icon tone-blue" aria-hidden /> Home
      </a>
      <Link href="/tools" className="nav-link" aria-current={current("all")} onClick={onClose}>
        <LayoutGrid size={19} className="nav-link-icon tone-blue" aria-hidden /> All tools
        <span className="nav-badge">{TOOLS.length}</span>
      </Link>
      <Link href="/tools?view=favorites" className="nav-link" aria-current={current("favorites")} onClick={onClose}>
        <Star size={19} className="nav-link-icon tone-amber" fill="currentColor" aria-hidden /> Favorites
        <span className="nav-badge">{favoriteCount}</span>
      </Link>
      <Link href="/tools?view=recent" className="nav-link" aria-current={current("recent")} onClick={onClose}>
        <History size={19} className="nav-link-icon tone-amber" aria-hidden /> Recently used
        <span className="nav-badge">{recentCount}</span>
      </Link>
    </nav>
  );
}

/** Reads ?view= only inside its own Suspense boundary, so every tool page stays static. */
function PrimaryNavFromUrl(props: { favoriteCount: number; recentCount: number; onClose: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("view");
  const view: View = pathname === "/tools" ? (requested === "favorites" || requested === "recent" ? requested : "all") : null;
  return <PrimaryNav view={view} {...props} />;
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

  // "/" focuses the filter unless the visitor is already typing somewhere. The header's ⌘K
  // search jumps straight to a tool; this one narrows the list in place.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement || target?.isContentEditable;
      if (event.key === "/" && !isTyping && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!normalizedQuery) return null;
    return TOOLS.filter((tool) =>
      `${tool.name} ${tool.tagline} ${tool.category}`.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery]);

  const favoriteCount = favorites.filter((id) => getToolById(id)).length;
  const recentCount = recents.filter((id) => getToolById(id)).length;
  const navProps = { favoriteCount, recentCount, onClose };

  return (
    <aside className={`tool-sidebar ${open ? "is-open" : ""}`} aria-label="Developer tools">
      <div className="sidebar-search-row">
        <label className="sidebar-search">
          <Search size={17} aria-hidden />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search tools..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
            aria-label="Filter tools in this list"
            aria-keyshortcuts="/"
          />
        </label>
        <button className="sidebar-close" aria-label="Close tools menu" onClick={onClose}><X size={20} /></button>
      </div>

      <Suspense fallback={<PrimaryNav view={null} {...navProps} />}>
        <PrimaryNavFromUrl {...navProps} />
      </Suspense>

      <div className="nav-scroll">
        {matches ? (
          <div className="nav-group">
            <p className="nav-group-label">{matches.length} {matches.length === 1 ? "match" : "matches"}</p>
            {matches.length ? (
              matches.map((tool) => <ToolRow key={tool.id} tool={tool} isActive={tool.slug === activeSlug} onClose={onClose} />)
            ) : (
              <p className="nav-empty">No tools match &ldquo;{query}&rdquo;.</p>
            )}
          </div>
        ) : (
          CATEGORY_ORDER.map((category) => {
            const tools = TOOLS.filter((tool) => tool.category === category);
            const isCollapsed = collapsed.includes(category);
            return (
              <div className="nav-group" key={category}>
                <button
                  type="button"
                  className="nav-group-toggle"
                  onClick={() => toggleCategory(category)}
                  aria-expanded={!isCollapsed}
                >
                  {category}
                  {isCollapsed ? <ChevronDown size={16} aria-hidden /> : <ChevronUp size={16} aria-hidden />}
                </button>
                {!isCollapsed && tools.map((tool) => (
                  <ToolRow key={tool.id} tool={tool} isActive={tool.slug === activeSlug} onClose={onClose} />
                ))}
              </div>
            );
          })
        )}
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          className="nav-link suggest-link"
          onClick={() => {
            onClose();
            openFeedback({ category: "feature_request", message: "Tool suggestion: " });
          }}
        >
          <SquarePlus size={19} aria-hidden /> Suggest a tool
        </button>
      </div>
    </aside>
  );
}
