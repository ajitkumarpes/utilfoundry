"use client";

import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { THEMES, ThemeId, getAppliedTheme, setThemeCookie } from "@/lib/theme";

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ThemeId>(getAppliedTheme);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function applyTheme(id: ThemeId) {
    document.documentElement.setAttribute("data-theme", id);
    setThemeCookie(id);
    setActive(id);
    setOpen(false);
  }

  return (
    <div className="theme-switcher" ref={rootRef}>
      <button
        type="button"
        className="theme-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Choose theme"
      >
        <Palette size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="theme-popover" role="menu">
          {THEMES.map(theme => (
            <button
              key={theme.id}
              type="button"
              role="menuitemradio"
              aria-checked={active === theme.id}
              className={`theme-option${active === theme.id ? " active" : ""}`}
              onClick={() => applyTheme(theme.id)}
            >
              <span
                className="theme-swatch"
                aria-hidden="true"
                style={{
                  background: `linear-gradient(135deg, ${theme.swatch[0]} 50%, ${theme.swatch[1]} 50%)`
                }}
              />
              {theme.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
