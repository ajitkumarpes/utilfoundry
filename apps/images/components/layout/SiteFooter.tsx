import Link from "next/link";
import { CONTACT_URL, DEVELOPER_URL, PARENT_URL, PDF_URL } from "@/lib/links";

const SITES = [
  { label: "UtilFoundry", href: PARENT_URL },
  { label: "PDF tools", href: PDF_URL },
  { label: "Developer tools", href: DEVELOPER_URL },
  { label: "Contact", href: CONTACT_URL }
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>© {new Date().getFullYear()} UtilFoundry. All rights reserved.</span>
      <nav aria-label="Footer">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        {SITES.map((link) => <a key={link.label} href={link.href}>{link.label}</a>)}
      </nav>
    </footer>
  );
}
