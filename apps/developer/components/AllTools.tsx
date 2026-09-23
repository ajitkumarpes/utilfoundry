"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { History, LayoutGrid, Star } from "lucide-react";
import { ACCENTS, ToolIcon } from "@/components/ui/ToolIcon";
import { CATEGORY_ORDER, TOOLS, getToolById, type ToolDefinition } from "@/lib/tools";
import { useFavorites, useRecents } from "@/lib/tool-prefs";

type View = "all" | "favorites" | "recent";

function ToolCard({ tool, isFavorite, onToggleFavorite }: {
  tool: ToolDefinition; isFavorite: boolean; onToggleFavorite: () => void;
}) {
  const accent = ACCENTS[tool.accent];
  return (
    <li className="catalog-card">
      <Link href={`/${tool.slug}`} className="catalog-link">
        <span className="catalog-icon" style={{ background: accent.tint, color: accent.ink }}>
          <ToolIcon id={tool.id} size={20} />
        </span>
        <span className="catalog-text">
          <b>{tool.name}</b>
          <small>{tool.tagline}</small>
        </span>
      </Link>
      <button
        type="button"
        className={`catalog-star${isFavorite ? " is-active" : ""}`}
        onClick={onToggleFavorite}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`}
      >
        <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
      </button>
    </li>
  );
}

/** Picks the view from ?view= — kept to this one component so it can sit in a Suspense boundary. */
export function AllTools() {
  const requested = useSearchParams().get("view");
  return <AllToolsView view={requested === "favorites" || requested === "recent" ? requested : "all"} />;
}

/** Every tool, or just the favorites or recent ones, as a grid. The sidebar filter searches it. */
export function AllToolsView({ view }: { view: View }) {
  const { favorites, toggle } = useFavorites();
  const { recents } = useRecents();

  const favoriteTools = favorites.map(getToolById).filter((tool): tool is ToolDefinition => tool !== undefined);
  const recentTools = recents.map(getToolById).filter((tool): tool is ToolDefinition => tool !== undefined);

  const sections = useMemo(() => {
    if (view === "favorites") return [{ title: "Favorites", tools: favoriteTools }];
    if (view === "recent") return [{ title: "Recently used", tools: recentTools }];
    return CATEGORY_ORDER.map((category) => ({ title: category, tools: TOOLS.filter((tool) => tool.category === category) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, favorites, recents]);

  const tabs: Array<{ id: View; label: string; count: number; icon: typeof Star; href: string }> = [
    { id: "all", label: "All tools", count: TOOLS.length, icon: LayoutGrid, href: "/tools" },
    { id: "favorites", label: "Favorites", count: favoriteTools.length, icon: Star, href: "/tools?view=favorites" },
    { id: "recent", label: "Recently used", count: recentTools.length, icon: History, href: "/tools?view=recent" }
  ];

  const empty = sections.every((section) => section.tools.length === 0);

  return (
    <>
      <div className="catalog-toolbar">
        <nav className="catalog-tabs" aria-label="Tool views">
          {tabs.map(({ id, label, count, icon: Icon, href }) => (
            <Link key={id} href={href} aria-current={view === id ? "page" : undefined}>
              <Icon size={16} aria-hidden fill={id === "favorites" && view === id ? "currentColor" : "none"} />
              {label}
              <span className="nav-badge">{count}</span>
            </Link>
          ))}
        </nav>
      </div>

      {empty ? (
        <div className="catalog-empty">
          {view === "favorites" ? (
            <p>No favorites yet. Open a tool and press <b>Add to favorites</b>, or star any card under <b>All tools</b>.</p>
          ) : (
            <p>Nothing here yet. The tools you open will be listed here, most recent first.</p>
          )}
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.title} className="catalog-section">
            <h2>{section.title} <span>{section.tools.length}</span></h2>
            <ul className="catalog-grid">
              {section.tools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  isFavorite={favorites.includes(tool.id)}
                  onToggleFavorite={() => toggle(tool.id)}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
