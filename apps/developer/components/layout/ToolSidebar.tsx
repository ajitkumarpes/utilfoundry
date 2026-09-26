"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Crown, History, House, LayoutGrid, Search, SquarePlus, Star, X } from "lucide-react";
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

function PrimaryNav({ view, onClose }: { view: View; onClose: () => void }) {
  return (
    <nav className="nav-primary" aria-label="Browse tools">
      <a href={PARENT_URL} className="nav-link" onClick={onClose}>
        <House size={19} className="nav-link-icon tone-blue" aria-hidden /> Home
      </a>
      <Link href="/tools" className="nav-link" aria-current={view === "all" ? "page" : undefined} onClick={onClose}>
        <LayoutGrid size={19} className="nav-link-icon tone-blue" aria-hidden /> All tools
        <span className="nav-badge">{TOOLS.length}</span>
      </Link>
    </nav>
  );
}

/** Reads ?view= only inside its own Suspense boundary, so every tool page stays static. */
function PrimaryNavFromUrl(props: { onClose: () => void }) {
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

  const favoriteTools = favorites.map(getToolById).filter((tool): tool is ToolDefinition => tool !== undefined);
  const recentTools = recents.map(getToolById).filter((tool): tool is ToolDefinition => tool !== undefined).slice(0, 5);
  const navProps = { onClose };
  const pinnedOpen = !collapsed.includes("__favorites");
  const recentOpen = !collapsed.includes("__recent");

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
          <>
          <div className="nav-group nav-pinned">
            <div className="nav-group-head">
              <button type="button" className="nav-group-toggle" onClick={() => toggleCategory("__favorites")} aria-expanded={pinnedOpen}>
                <span><Star size={14} className="tone-amber" fill="currentColor" aria-hidden /> Favorites</span>
                {pinnedOpen ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
              </button>
              <Link href="/tools?view=favorites" className="nav-group-link" onClick={onClose}>Manage</Link>
            </div>
            {pinnedOpen && (favoriteTools.length ? (
              favoriteTools.map((tool) => <ToolRow key={tool.id} tool={tool} isActive={tool.slug === activeSlug} onClose={onClose} />)
            ) : (
              <p className="nav-empty">Star a tool with <b>Add to favorites</b> to pin it here.</p>
            ))}
          </div>
          {recentTools.length > 0 && (
            <div className="nav-group nav-pinned">
              <div className="nav-group-head">
                <button type="button" className="nav-group-toggle" onClick={() => toggleCategory("__recent")} aria-expanded={recentOpen}>
                  <span><History size={14} className="tone-blue" aria-hidden /> Recently used</span>
                  {recentOpen ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
                </button>
                <Link href="/tools?view=recent" className="nav-group-link" onClick={onClose}>All</Link>
              </div>
              {recentOpen && recentTools.map((tool) => (
                <ToolRow key={tool.id} tool={tool} isActive={tool.slug === activeSlug} onClose={onClose} />
              ))}
            </div>
          )}
          {CATEGORY_ORDER.map((category) => {
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
          })}
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <Link href="/tools" className="sidebar-promo" onClick={onClose}>
          <Crown size={22} className="tone-amber" aria-hidden />
          <span>
            <b>{TOOLS.length} Developer Tools</b>
            <small>Everything runs in your browser.</small>
          </span>
        </Link>
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
