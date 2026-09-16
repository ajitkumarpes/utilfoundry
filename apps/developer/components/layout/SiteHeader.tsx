"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, Moon, Search, Sun } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { IMAGES_URL, PARENT_URL, PDF_URL } from "@/lib/links";
import { TOOLS } from "@/lib/tools";

/** This app first, then its sibling UtilFoundry products. */
const NAV = [
  { label: "Developer tools", href: "/" },
  { label: "Image tools", href: IMAGES_URL },
  { label: "PDF tools", href: PDF_URL },
  { label: "All products", href: PARENT_URL }
];

type SiteHeaderProps = { onOpenMenu: () => void };

export function SiteHeader({ onOpenMenu }: SiteHeaderProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

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

  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="mobile-menu" aria-label="Open tools menu" onClick={onOpenMenu}><Menu size={20} /></button>

        <Link className="brand" href="/" aria-label="UtilFoundry Developer Tools home">
          <BrandMark />
          <span className="brand-text"><b>UtilFoundry</b><em>DEV</em></span>
        </Link>

        <nav className="primary-nav" aria-label="Primary">
          {NAV.map((item) => item.href.startsWith("/")
            ? <Link key={item.label} href={item.href} aria-current="page">{item.label}</Link>
            : <a key={item.label} href={item.href}>{item.label}</a>)}
        </nav>

        <div ref={boxRef} className="global-search" style={{ position: "relative" }}>
          <Search size={17} aria-hidden />
          <input
            ref={searchRef}
            aria-label="Search developer tools"
            placeholder="Search developer tools..."
            value={query}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          <kbd>⌘ K</kbd>
          {open && normalized.length > 0 && (
            <div className="search-results" role="listbox">
              {matches.length === 0
                ? <p className="search-empty">No tool matches “{query}”.</p>
                : matches.map((tool) => (
                  <Link key={tool.id} href={`/${tool.slug}`} onClick={() => { setOpen(false); setQuery(""); }}>
                    <ToolIcon id={tool.id} size={16} />
                    {tool.name}
                    <small>{tool.category}</small>
                  </Link>
                ))}
            </div>
          )}
        </div>

        <div className="header-actions">
          <button className="icon-button" onClick={toggleTheme} aria-label="Switch colour theme">
            <Sun size={20} className="theme-light-only" />
            <Moon size={20} className="theme-dark-only" />
          </button>
        </div>
      </div>
    </header>
  );
}
