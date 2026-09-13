import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <b>P</b> PDF<span>Lab</span>
      </Link>
      <nav className="desktop-nav" aria-label="Tool categories">
        <Link href="/#organize-tools">Organize</Link>
        <Link href="/#convert-tools">Convert</Link>
        <Link href="/#office-tools">Office</Link>
        <Link href="/#optimize-tools">Optimize</Link>
        <Link href="/#protect-tools">Protect</Link>
      </nav>
      <details className="mobile-nav">
        <summary>Tools</summary>
        <nav className="mobile-nav-links" aria-label="Tool categories">
          <Link href="/#organize-tools">Organize</Link>
          <Link href="/#convert-tools">Convert</Link>
          <Link href="/#office-tools">Office</Link>
          <Link href="/#optimize-tools">Optimize</Link>
          <Link href="/#protect-tools">Protect</Link>
        </nav>
      </details>
    </header>
  );
}
