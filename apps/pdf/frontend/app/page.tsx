import Link from "next/link";
import { ArrowRight, Globe, Leaf, Lock, Rocket, ShieldCheck, Users, Zap } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ToolCatalog from "@/components/ToolCatalog";
import { TOOL_COUNT } from "@/lib/tools";

/** Parent UtilFoundry site that hosts this and the other tool verticals. */
const PARENT_SITE_URL = process.env.NEXT_PUBLIC_PARENT_URL || "http://localhost:3001";

const HERO_FEATURES = [
  {
    icon: ShieldCheck,
    color: "#16a34a",
    tint: "#dcfce7",
    title: "100% Free",
    detail: "No account required"
  },
  {
    icon: Lock,
    color: "#2563eb",
    tint: "#dbeafe",
    title: "Your files stay private",
    detail: "Deleted automatically within 1 hour"
  },
  {
    icon: Zap,
    color: "#9333ea",
    tint: "#f3e8ff",
    title: "Fast & reliable",
    detail: "Most tools finish in seconds"
  }
];

const TRUST_ITEMS: {
  icon: typeof ShieldCheck;
  title: string;
  detail: string;
  color?: string;
}[] = [
  { icon: Users, title: "Trusted by millions", detail: "Simple tools. Real results." },
  { icon: Globe, title: "Works on any device", detail: "Windows, Mac, Linux, Mobile" },
  { icon: ShieldCheck, title: "No installation", detail: "Use directly in your browser" },
  { icon: Zap, title: "Built for productivity", detail: "Save time, do more", color: "#f5a524" },
  { icon: Leaf, title: "Part of a cleaner internet", detail: "Private. Secure. Accessible.", color: "#22c55e" }
];

export default function Home() {
  return (
    <main>
      <SiteHeader />

      <section className="hero-v2">
        <div className="hero-copy">
          <div className="hero-eyebrow">PDF Tools</div>
          <h1>
            Everything you need
            <br />
            for PDF, <span className="highlight">in one place.</span>
          </h1>
          <p className="hero-sub">
            Merge, split, organize, OCR, convert, compress, watermark, lock,
            sign and redact PDFs — {TOOL_COUNT} free tools, processed
            privately and removed automatically. No account needed.
          </p>
          <div className="hero-actions">
            <Link href="/tools/merge-pdf" className="primary-btn">
              Start with Merge PDF <ArrowRight size={18} />
            </Link>
            <a href="#organize-tools" className="secondary-btn">
              Explore tools
            </a>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <span className="spark s1" />
          <span className="spark s2" />
          <span className="spark s3" />
          <div className="doc doc-side doc-left">
            <span className="line" />
            <span className="line" />
            <span className="line" />
            <span className="line" />
          </div>
          <div className="doc doc-side doc-right">
            <span className="line" />
            <span className="line" />
            <span className="line" />
            <span className="line" />
          </div>
          <div className="doc doc-main">
            <div className="pdf-badge">
              <svg viewBox="0 0 64 64" width="60" height="60" aria-hidden="true">
                <path
                  d="M16 4h20.5L52 19.5V56a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"
                  fill="#e1252a"
                />
                <path d="M36.5 4 52 19.5H40.5a4 4 0 0 1-4-4V4Z" fill="#f4756f" />
                <rect x="21" y="32" width="22" height="4.4" rx="2.2" fill="#fff" />
                <rect x="21" y="41" width="15" height="4.4" rx="2.2" fill="#fff" opacity=".82" />
              </svg>
            </div>
            <strong>PDF</strong>
          </div>
        </div>

        <div className="hero-features">
          {HERO_FEATURES.map(feature => (
            <div className="hero-feature" key={feature.title}>
              <div className="icon" style={{ background: feature.tint, color: feature.color }}>
                <feature.icon size={18} aria-hidden="true" />
              </div>
              <div>
                <strong>{feature.title}</strong>
                <span>{feature.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="tools" className="tool-section">
        <ToolCatalog />
      </section>

      <section className="cta-banner">
        <div className="cta-banner-text">
          <div className="cta-icon">
            <Rocket size={26} aria-hidden="true" />
          </div>
          <div>
            <h2>Work smarter with UtilFoundry tools</h2>
            <p>
              Explore the wider UtilFoundry toolbox — free, fast and private,
              with more tools on the way.
            </p>
          </div>
        </div>
        <a href={PARENT_SITE_URL} className="primary-btn">
          Explore all tools <ArrowRight size={18} />
        </a>
      </section>

      <div className="trust-grid">
        {TRUST_ITEMS.map(item => (
          <div className="trust-item" key={item.title}>
            <div className="icon" style={item.color ? { color: item.color } : undefined}>
              <item.icon size={20} aria-hidden="true" />
            </div>
            <div>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
          </div>
        ))}
      </div>

      <SiteFooter />
    </main>
  );
}
