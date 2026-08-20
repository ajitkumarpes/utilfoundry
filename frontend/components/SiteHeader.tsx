import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <b>P</b> PDF<span>Lab</span>
      </Link>
      <nav>
        <a href="/#organize-tools">Organize</a>
        <a href="/#convert-tools">Convert</a>
        <a href="/#office-tools">Office</a>
        <a href="/#optimize-tools">Optimize</a>
      </nav>
    </header>
  );
}
