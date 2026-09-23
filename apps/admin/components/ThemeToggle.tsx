"use client";

import { Moon, Sun } from "lucide-react";

/** The theme lives on <html data-theme>, set before paint; CSS decides which icon shows. */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("uf-admin-theme", next);
    } catch {
      // Storage is optional; the choice just will not persist.
    }
  }
  return (
    <button type="button" className="icon-button" onClick={toggle} aria-label="Switch colour theme" title="Switch colour theme">
      <Moon size={19} className="theme-light-only" aria-hidden />
      <Sun size={19} className="theme-dark-only" aria-hidden />
    </button>
  );
}
