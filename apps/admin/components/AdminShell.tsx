"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Loader2, LogOut, Menu, MessageSquareText, Users, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquareText },
  { href: "/admin/visitors", label: "Visitors", icon: Users }
];

function BrandMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0f1a33" />
      <path d="M18 17V33C18 42.5 23.6 48 32 48C40.4 48 46 42.5 46 33V17" stroke="#F4B183" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M16 51H48" stroke="#F4B183" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function AdminShell({ unreviewed, children }: { unreviewed: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="topbar">
        <button type="button" className="icon-button menu-button" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          <Menu size={20} />
        </button>
        <Link href="/admin" className="brand">
          <BrandMark />
          <span className="brand-text"><b>UtilFoundry</b><em>ADMIN</em></span>
        </Link>
        <div className="topbar-actions">
          <ThemeToggle />
        </div>
      </header>

      <aside className={`sidebar${menuOpen ? " is-open" : ""}`} aria-label="Admin">
        <div className="sidebar-head">
          <span className="sidebar-title">Navigation</span>
          <button type="button" className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Admin sections">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className="nav-link" aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)}>
                <Icon size={19} aria-hidden />
                {label}
                {href === "/admin/feedback" && unreviewed > 0 && (
                  <span className="nav-badge" title={`${unreviewed} awaiting review`}>
                    {unreviewed}<span className="sr-only"> awaiting review</span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <button type="button" className="nav-link" onClick={signOut} disabled={signingOut}>
            {signingOut ? <Loader2 size={19} className="spin" aria-hidden /> : <LogOut size={19} aria-hidden />}
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>
      {menuOpen && <button type="button" className="scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <main id="main" className="main">{children}</main>
    </div>
  );
}
