"use client";

import { Moon, Sun } from "lucide-react";

/**
 * The theme lives on the root element, not in React state: the inline script in
 * the layout sets it before paint, and CSS decides which icon shows. That keeps
 * the button correct on first render with no hydration mismatch.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { window.localStorage.setItem("utilfoundry-theme", next); } catch { /* storage is optional */ }
  }

  return (
    <button type="button" className="icon-button" onClick={toggle} aria-label="Switch colour theme">
      <Sun size={19} className="theme-light-only" />
      <Moon size={19} className="theme-dark-only" />
    </button>
  );
}
