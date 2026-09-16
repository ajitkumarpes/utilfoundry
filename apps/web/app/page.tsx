import { ArrowRight, Check, Code2, FileText, ImageIcon, Layers, LockKeyhole, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { DEVELOPER_URL, IMAGES_URL, PDF_URL } from "@/lib/links";

/** Counts are the real number of tool pages in each app, not marketing numbers. */
const products = [
  {
    href: PDF_URL,
    label: "PDF platform",
    count: "36 tools",
    title: "Every PDF job, one workspace.",
    description: "Merge, split, convert, compress, sign, redact and organise documents, with OCR and repair when a file fights back.",
    icon: FileText,
    tone: { color: "var(--purple)", tint: "var(--purple-tint)" }
  },
  {
    href: DEVELOPER_URL,
    label: "Developer tools",
    count: "70 tools",
    title: "From idea to deploy, faster.",
    description: "Format, validate, decode, diff and generate — JSON, JWT, regex, OpenAPI, protobuf and payment protocol inspectors included.",
    icon: Code2,
    tone: { color: "var(--blue)", tint: "var(--blue-tint)" }
  },
  {
    href: IMAGES_URL,
    label: "Image tools",
    count: "30 tools",
    title: "Get every image ready to share.",
    description: "Compress, resize, crop, convert and watermark, plus background removal, upscaling and OCR on our own server.",
    icon: ImageIcon,
    tone: { color: "var(--accent)", tint: "var(--accent-tint)" }
  }
];

const principles = [
  {
    icon: LockKeyhole,
    title: "Private by default",
    body: "Developer tools never leave your browser. Image editing is local too, apart from six tools — the compressor, the converter and the four model-backed ones — that run on our own server and keep nothing."
  },
  {
    icon: Check,
    title: "Honest about limits",
    body: "Every tool says what it does and what it will not do. No placeholder features, no silent failures, and errors that tell you what to fix."
  },
  {
    icon: Layers,
    title: "One job, done well",
    body: "Each tool has its own page and its own controls, so you can link to it, share it and come back to exactly the screen you needed."
  }
];

const roadmap = ["Data converters", "Text tools", "Security helpers", "Protocol diagnostics", "Productivity workflows"];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>

      <SiteHeader />

      <main id="main">
        <section className="shell hero">
          <div>
            <p className="eyebrow"><Sparkles size={14} aria-hidden /> 136 tools across three workspaces</p>
            <h1 className="hero-title">Useful tools.<br /><em>Quietly excellent.</em></h1>
            <p className="hero-sub">
              UtilFoundry is where the small jobs get done: a PDF that needs splitting, a token that needs
              decoding, a screenshot that needs shrinking. Fast tools that respect your attention and your files.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#products">Explore the tools <ArrowRight size={16} /></a>
              <a className="btn btn-ghost" href="#principles">How we handle your files</a>
            </div>
            <div className="stat-row">
              <div>
                <p className="stat-value">136</p>
                <p className="stat-label">Tools available today</p>
              </div>
              <div>
                <p className="stat-value">3</p>
                <p className="stat-label">Focused workspaces</p>
              </div>
              <div>
                <p className="stat-value">0</p>
                <p className="stat-label">Accounts required</p>
              </div>
            </div>
          </div>

          <div className="hero-panel">
            <span className="hero-glow hero-glow-1" aria-hidden />
            <span className="hero-glow hero-glow-2" aria-hidden />
            <BrandMark size={52} />
            <p className="hero-panel-title">One calm place for useful work.</p>
            <div className="hero-panel-list">
              <span><Check size={16} aria-hidden /> Developer tools run entirely in your browser</span>
              <span><Check size={16} aria-hidden /> Image editing is local, bar six server-backed tools</span>
              <span><Check size={16} aria-hidden /> No account, no sign-up, no upsell</span>
            </div>
            <p className="hero-panel-note">Nothing is kept for longer than the job needs.</p>
          </div>
        </section>

        <section id="products" className="shell section">
          <div className="section-head">
            <p className="kicker">Explore the platform</p>
            <h2 className="section-title">Tools for the work between the work.</h2>
            <p className="section-lead">Three workspaces, each with its own tools, its own pages and the same standards.</p>
          </div>
          <div className="product-grid">
            {products.map((product) => {
              const Icon = product.icon;
              return (
                <a className="product-card" href={product.href} key={product.href}>
                  <div className="product-top">
                    <span className="product-icon" style={{ background: product.tone.tint, color: product.tone.color }}>
                      <Icon size={24} aria-hidden />
                    </span>
                    <span className="product-count">{product.count}</span>
                  </div>
                  <p className="kicker">{product.label}</p>
                  <h3 className="product-title">{product.title}</h3>
                  <p className="product-desc">{product.description}</p>
                  <span className="product-cta">Open workspace <ArrowRight size={15} aria-hidden /></span>
                </a>
              );
            })}
          </div>
        </section>

        <section id="principles" className="shell section">
          <div className="section-head">
            <p className="kicker">The UtilFoundry standard</p>
            <h2 className="section-title">Designed to stay out of your way.</h2>
          </div>
          <div className="principle-grid">
            {principles.map((principle) => {
              const Icon = principle.icon;
              return (
                <div className="principle" key={principle.title}>
                  <span className="principle-icon"><Icon size={20} aria-hidden /></span>
                  <h3>{principle.title}</h3>
                  <p>{principle.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="roadmap" className="shell section">
          <div className="roadmap-grid">
            <div>
              <p className="kicker">What is next</p>
              <h2 className="section-title">A growing toolkit, one category at a time.</h2>
              <p className="section-lead">
                We add a category when it is genuinely finished, rather than shipping a menu of half-built screens.
                These are the ones we are working towards.
              </p>
            </div>
            <div className="chip-row">
              {roadmap.map((item) => <span className="chip" key={item}>{item}</span>)}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
