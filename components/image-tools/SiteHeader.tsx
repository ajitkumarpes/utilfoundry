"use client";

import { ChevronDown, Menu, Moon, Search, Sun } from "lucide-react";
import { useEffect, useRef } from "react";
import { BrandMark } from "@/components/BrandMark";

type SiteHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onOpenMenu: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export function SiteHeader({ query, onQueryChange, onOpenMenu, theme, onToggleTheme }: SiteHeaderProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="mobile-menu" aria-label="Open tools menu" onClick={onOpenMenu}>
          <Menu size={20} />
        </button>
        <a className="brand" href="#top" aria-label="UtilFoundry Images home">
          <BrandMark size={45} />
          <span>UtilFoundry<em>IMAGES</em></span>
        </a>
        <nav className="primary-nav" aria-label="Primary navigation">
          <a href="#tools">Tools</a><a href="#templates">Templates</a><a href="#pricing">Pricing</a><a href="#docs">Docs</a><a href="#blog">Blog</a>
        </nav>
        <label className="global-search">
          <Search size={18} />
          <input ref={searchRef} aria-label="Search image tools" placeholder="Search image tools..." value={query} onChange={(event) => onQueryChange(event.target.value)} />
          <kbd>⌘ K</kbd>
        </label>
        <div className="header-actions">
          <button className="icon-button" aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} onClick={onToggleTheme}>{theme === "light" ? <Moon size={20} /> : <Sun size={20} />}</button>
          <span className="header-divider" />
          <span className="avatar-button" aria-label="Account menu"><span>A</span><ChevronDown size={15} /></span>
        </div>
      </div>
    </header>
  );
}
