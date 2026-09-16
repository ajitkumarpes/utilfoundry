import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PDF_URL } from "@/lib/links";

/**
 * The section links are absolute (`/#products`), not bare fragments, so the header
 * works unchanged on the legal pages, where those sections are not on the page.
 */
const SECTIONS = [
  { label: "Products", href: "/#products" },
  { label: "Why UtilFoundry", href: "/#principles" },
  { label: "Roadmap", href: "/#roadmap" }
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/">
          <BrandMark size={34} />
          <span className="brand-text">UtilFoundry</span>
        </Link>
        <nav className="site-nav" aria-label="Primary">
          {SECTIONS.map((section) => <Link key={section.label} href={section.href}>{section.label}</Link>)}
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <a className="btn btn-primary" href={PDF_URL}>Open a tool <ArrowRight size={16} /></a>
        </div>
      </div>
    </header>
  );
}
