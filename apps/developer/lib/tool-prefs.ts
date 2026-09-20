"use client";

/**
 * Sidebar preferences — favorites, recently used, and which categories are
 * collapsed — kept in one localStorage blob, the same single-key-per-concern
 * shape as utilfoundry-dev-workspace and utilfoundry-theme elsewhere in this
 * app. Never sent anywhere; this is the same "stays on your machine" promise
 * the rest of the app already makes.
 *
 * Backed by useSyncExternalStore rather than a plain useState-per-hook: the
 * favorite star lives in PageHeader while the Favorites list it feeds lives in
 * ToolSidebar, two independent components that both need to see the same
 * write immediately, not just after their next remount.
 */

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "utilfoundry-dev-sidebar-prefs";
const MAX_RECENTS = 8;

type SidebarPrefs = {
  favorites: string[];
  recents: string[];
  collapsed: string[];
};

const EMPTY: SidebarPrefs = { favorites: [], recents: [], collapsed: [] };

function readPrefs(): SidebarPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<SidebarPrefs>;
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      recents: Array.isArray(parsed.recents) ? parsed.recents : [],
      collapsed: Array.isArray(parsed.collapsed) ? parsed.collapsed : []
    };
  } catch {
    return EMPTY;
  }
}

let cached: SidebarPrefs = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function getSnapshot(): SidebarPrefs {
  if (!hydrated) {
    cached = readPrefs();
    hydrated = true;
  }
  return cached;
}

function getServerSnapshot(): SidebarPrefs {
  return EMPTY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: SidebarPrefs) {
  cached = next;
  hydrated = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Local storage unavailable (private mode, quota) — preferences just don't persist.
  }
  listeners.forEach((listener) => listener());
}

function usePrefs() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useFavorites() {
  const prefs = usePrefs();

  const toggle = useCallback((toolId: string) => {
    const current = getSnapshot();
    const favorites = current.favorites.includes(toolId)
      ? current.favorites.filter((id) => id !== toolId)
      : [...current.favorites, toolId];
    commit({ ...current, favorites });
  }, []);

  return { favorites: prefs.favorites, toggle };
}

export function useRecents() {
  const prefs = usePrefs();

  const record = useCallback((toolId: string) => {
    const current = getSnapshot();
    const recents = [toolId, ...current.recents.filter((id) => id !== toolId)].slice(0, MAX_RECENTS);
    commit({ ...current, recents });
  }, []);

  return { recents: prefs.recents, record };
}

export function useCollapsedCategories() {
  const prefs = usePrefs();

  const toggle = useCallback((category: string) => {
    const current = getSnapshot();
    const collapsed = current.collapsed.includes(category)
      ? current.collapsed.filter((c) => c !== category)
      : [...current.collapsed, category];
    commit({ ...current, collapsed });
  }, []);

  return { collapsed: prefs.collapsed, toggle };
}
