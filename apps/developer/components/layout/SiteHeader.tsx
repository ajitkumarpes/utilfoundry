"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Menu, Moon, Search, Sun } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { ACCENTS, ToolIcon } from "@/components/ui/ToolIcon";
import { IMAGES_URL, PARENT_URL, PDF_URL } from "@/lib/links";
import { TOOLS } from "@/lib/tools";
import { useIsMac } from "@/lib/use-platform";

/** This app first, then its sibling UtilFoundry products. */
const NAV = [
  { label: "Developer tools", href: "/tools" },
  { label: "Image tools", href: IMAGES_URL },
  { label: "PDF tools", href: PDF_URL },
  { label: "All products", href: PARENT_URL }
];

type SiteHeaderProps = { onOpenMenu: () => void };

export function SiteHeader({ onOpenMenu }: SiteHeaderProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isMac = useIsMac();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") setOpen(false);
    }
    function onClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  /**
   * The theme lives on the root element, not in React state: the inline script in
   * the root layout sets it before paint, and CSS decides which icon shows.
   */
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { window.localStorage.setItem("utilfoundry-theme", next); } catch { /* storage is optional */ }
  }

  const normalized = query.trim().toLowerCase();
  const matches = normalized
    ? TOOLS.filter((tool) => `${tool.name} ${tool.tagline} ${tool.description}`.toLowerCase().includes(normalized)).slice(0, 8)
    : [];

  function onSearchKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!matches.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlighted((index) => (index + step + matches.length) % matches.length);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const tool = matches[Math.min(highlighted, matches.length - 1)];
      setOpen(false);
      setQuery("");
      searchRef.current?.blur();
      router.push(`/${tool.slug}`);
    }
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="mobile-menu" aria-label="Open tools menu" onClick={onOpenMenu}><Menu size={20} /></button>

        <Link className="brand" href="/" aria-label="UtilFoundry Developer Tools home">
          <BrandMark />
          <span className="brand-text"><b>UtilFoundry</b><em>DEV TOOLS</em></span>
        </Link>

        <nav className="primary-nav" aria-label="Primary">
          {NAV.map((item) => item.href.startsWith("/")
            ? <Link key={item.label} href={item.href} className="is-active">{item.label}</Link>
            : <a key={item.label} href={item.href}>{item.label}</a>)}
        </nav>

        <div ref={boxRef} className="global-search" style={{ position: "relative" }}>
          <Search size={17} aria-hidden />
          <input
            ref={searchRef}
            aria-label="Search developer tools"
            placeholder="Search tools, e.g. JSON, XML, Base64..."
            value={query}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); setHighlighted(0); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onSearchKey}
            aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
          />
          <kbd aria-hidden="true">{isMac ? "⌘" : "Ctrl"} K</kbd>
          {open && normalized.length > 0 && (
            <div className="search-results">
              {matches.length === 0
                ? <p className="search-empty">No tool matches “{query}”.</p>
                : matches.map((tool, index) => (
                  <Link
                    key={tool.id}
                    href={`/${tool.slug}`}
                    className={index === highlighted ? "is-highlighted" : undefined}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => { setOpen(false); setQuery(""); }}
                  >
                    <span style={{ color: ACCENTS[tool.accent].color }}><ToolIcon id={tool.id} size={16} /></span>
                    {tool.name}
                    <small>{tool.category}</small>
                  </Link>
                ))}
            </div>
          )}
        </div>

        <div className="header-actions">
          <button className="icon-button" onClick={toggleTheme} aria-label="Switch colour theme" title="Switch colour theme">
            <Moon size={20} className="theme-light-only" />
            <Sun size={21} className="theme-dark-only" />
          </button>
        </div>
      </div>
    </header>
  );
}
