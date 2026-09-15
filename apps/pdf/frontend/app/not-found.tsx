import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <main>
      <SiteHeader />
      <section className="tool-hero">
        <h1>Page not found</h1>
        <p>That page doesn&apos;t exist, or the link is broken. Every tool is listed on the homepage.</p>
        <Link href="/" className="primary-btn" style={{ marginTop: 24 }}>
          Back to all tools
        </Link>
      </section>
      <SiteFooter />
    </main>
  );
}
