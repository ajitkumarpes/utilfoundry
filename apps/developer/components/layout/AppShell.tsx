"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ToolSidebar } from "@/components/layout/ToolSidebar";
import FeedbackWidget from "@/components/FeedbackWidget";
import VisitBeacon from "@/components/VisitBeacon";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <SiteHeader onOpenMenu={() => setMenuOpen(true)} />
      <div className="app-layout">
        <ToolSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        {menuOpen && <button className="sidebar-scrim" aria-label="Close tools menu" onClick={() => setMenuOpen(false)} />}
        <main className="main-area">{children}</main>
      </div>
      <FeedbackWidget />
      <VisitBeacon />
    </>
  );
}
