import { Github, Linkedin, Twitter } from "lucide-react";

const LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Blog", href: "/blog" },
  { label: "Docs", href: "/docs" },
  { label: "Contact", href: "/contact" }
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>© {new Date().getFullYear()} UtilFoundry. All rights reserved.</span>
      <nav aria-label="Footer">
        {LINKS.map((link) => <a key={link.label} href={link.href}>{link.label}</a>)}
        <span className="footer-social">
          <a href="https://github.com" aria-label="GitHub"><Github size={17} /></a>
          <a href="https://linkedin.com" aria-label="LinkedIn"><Linkedin size={17} /></a>
          <a href="https://x.com" aria-label="X"><Twitter size={17} /></a>
        </span>
      </nav>
    </footer>
  );
}
