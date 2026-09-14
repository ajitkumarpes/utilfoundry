"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { searchTools } from "@/lib/tools";

export default function HeaderSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = searchTools(query);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isShortcut) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function go(href: string) {
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    router.push(href);
  }

  return (
    <div className="header-search" ref={rootRef}>
      <button
        type="button"
        className="header-search-icon"
        onClick={() => inputRef.current?.focus()}
        aria-label="Search tools"
        tabIndex={-1}
      >
        <Search size={16} aria-hidden="true" />
      </button>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={event => {
          if (event.key === "Enter" && results[0]) go(results[0].href);
        }}
        placeholder="Search tools…"
        aria-label="Search PDF tools"
        role="combobox"
        aria-expanded={open && query.trim().length > 0}
        aria-controls="header-search-results"
      />
      <kbd>⌘K</kbd>

      {open && query.trim().length > 0 && (
        <div className="header-search-results" id="header-search-results" role="listbox">
          {results.length ? (
            results.map(tool => (
              <button
                key={tool.href}
                type="button"
                role="option"
                aria-selected={false}
                className={`cat-${tool.color}`}
                onClick={() => go(tool.href)}
              >
                <span className="dot" aria-hidden="true" />
                {tool.name}
                <span className="group-label">{tool.groupTitle}</span>
              </button>
            ))
          ) : (
            <p className="no-results">No tools match &ldquo;{query}&rdquo;.</p>
          )}
        </div>
      )}
    </div>
  );
}
