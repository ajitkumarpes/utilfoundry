"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, Moon, Search, Sun } from "lucide-react";
import { BrandMark } from "@/components/layout/BrandMark";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { TOOLS } from "@/lib/tools";

const NAV = [
  { label: "Tools", href: "/" },
  { label: "Templates", href: "/templates" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Blog", href: "/blog" }
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
   * the root layout sets it before paint, and CSS decides which icon shows. That
   * keeps the button correct on first render with no hydration mismatch.
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

        <Link className="brand" href="/" aria-label="UtilFoundry Images home">
          <BrandMark size={40} />
          <span className="brand-text"><b>UtilFoundry</b><em>IMAGES</em></span>
        </Link>

        <nav className="primary-nav" aria-label="Primary">
          {NAV.map((item) => <Link key={item.label} href={item.href}>{item.label}</Link>)}
        </nav>

        <div ref={boxRef} className="global-search" style={{ position: "relative" }}>
          <Search size={17} aria-hidden />
          <input
            ref={searchRef}
            aria-label="Search image tools"
            placeholder="Search image tools..."
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
                  <Link key={tool.id} href={`/${tool.id}`} onClick={() => { setOpen(false); setQuery(""); }}>
                    <ToolIcon id={tool.id} size={16} />
                    {tool.name}
                    <small>{tool.comingSoon ? "Soon" : tool.category}</small>
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
          <span className="header-divider" />
          <button className="avatar-button" aria-label="Account menu"><i>A</i><ChevronDown size={15} /></button>
        </div>
      </div>
    </header>
  );
}
