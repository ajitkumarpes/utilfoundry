import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { CONTACT_URL, DEVELOPER_URL, IMAGES_URL, PDF_URL } from "@/lib/links";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-top">
          <div>
            <Link className="brand" href="/">
              <BrandMark size={30} />
              <span className="brand-text">UtilFoundry</span>
            </Link>
            <p className="footer-blurb">Practical tools, crafted well. Most of them never send your file anywhere.</p>
          </div>
          <nav className="footer-nav" aria-label="Footer">
            <div className="footer-col">
              <strong>Products</strong>
              <a href={PDF_URL}>PDF tools</a>
              <a href={DEVELOPER_URL}>Developer tools</a>
              <a href={IMAGES_URL}>Image tools</a>
            </div>
            <div className="footer-col">
              <strong>This site</strong>
              <Link href="/#products">Products</Link>
              <Link href="/#principles">Why UtilFoundry</Link>
              <Link href="/#roadmap">Roadmap</Link>
            </div>
            <div className="footer-col">
              <strong>Legal</strong>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
              <a href={CONTACT_URL}>Contact</a>
            </div>
          </nav>
        </div>
        <p className="footer-legal">© {new Date().getFullYear()} UtilFoundry. All rights reserved.</p>
      </div>
    </footer>
  );
}
