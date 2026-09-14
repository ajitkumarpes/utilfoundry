import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { TOOL_GROUPS } from "@/lib/tools";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import HeaderSearch from "@/components/HeaderSearch";
import { BrandMark } from "./BrandMark";

const NAV_LABELS: Record<string, string> = {
  "organize-tools": "Organize",
  "convert-tools": "Convert",
  "office-tools": "Office",
  "optimize-tools": "Optimize",
  "protect-tools": "Protect"
};

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <BrandMark size={32} /> <span>UtilFoundry <em>PDF</em></span>
      </Link>
      <div className="header-right">
        <nav className="desktop-nav" aria-label="Tool categories">
          {TOOL_GROUPS.map(group => (
            <div className="nav-item" key={group.id}>
              <Link href={`/#${group.id}`}>
                {NAV_LABELS[group.id] ?? group.title}
                <ChevronDown size={14} aria-hidden="true" />
              </Link>
              <div className="nav-popover">
                <div className="nav-popover-inner">
                  {group.tools.map(tool => (
                    <Link key={tool.href} href={tool.href}>
                      {tool.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </nav>
        <HeaderSearch />
        <ThemeSwitcher />
        <details className="mobile-nav">
          <summary>Tools</summary>
          <nav className="mobile-nav-links" aria-label="Tool categories">
            {TOOL_GROUPS.map(group => (
              <Link key={group.id} href={`/#${group.id}`}>
                {NAV_LABELS[group.id] ?? group.title}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
