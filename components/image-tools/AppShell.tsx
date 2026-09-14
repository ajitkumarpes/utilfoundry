"use client";

import { SiteHeader } from "@/components/image-tools/SiteHeader";
import { ToolSidebar } from "@/components/image-tools/ToolSidebar";
import type { ToolId } from "@/lib/tools";

type AppShellProps = {
  children: React.ReactNode;
  query: string;
  onQueryChange: (value: string) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  activeTool: ToolId;
  matchingIds: Set<ToolId>;
  mobileNav: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onSelectTool: (id: ToolId) => void;
};

export function AppShell({ children, query, onQueryChange, theme, onToggleTheme, activeTool, matchingIds, mobileNav, onOpenMenu, onCloseMenu, onSelectTool }: AppShellProps) {
  return (
    <div className="site-shell">
      <SiteHeader query={query} onQueryChange={onQueryChange} onOpenMenu={onOpenMenu} theme={theme} onToggleTheme={onToggleTheme} />
      <div className="app-layout">
        <ToolSidebar activeTool={activeTool} matchingIds={matchingIds} mobileNav={mobileNav} onSelect={onSelectTool} onClose={onCloseMenu} />
        <main id="top" className="main-area">{children}</main>
      </div>
    </div>
  );
}
