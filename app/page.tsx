import Link from "next/link";
import { ArrowRight, Check, Code2, FileText, LockKeyhole, Sparkles } from "lucide-react";

const products = [
  {
    href: "https://pdf.utilnexa.com",
    label: "PDF platform",
    title: "Make every PDF moment simpler.",
    description: "Merge, split, convert, compress, protect, sign, and organize documents in one focused workspace.",
    icon: FileText,
    tone: "lavender",
  },
  {
    href: "https://dev.utilnexa.com",
    label: "Developer tools",
    title: "Move from idea to deploy faster.",
    description: "Format, validate, decode, compare, inspect, and generate with 70 browser-local developer utilities.",
    icon: Code2,
    tone: "blue",
  },
];

const futureTools = ["Data converters", "Image utilities", "Text tools", "Security helpers", "Protocol diagnostics", "Productivity workflows"];

export default function Home() {
  return (
    <main>
      <nav className="nav shell-width" aria-label="Main navigation">
        <Link className="brand" href="/"><span className="brand-mark">U</span><span>UtilNexa</span></Link>
        <div className="nav-links"><a href="#products">Products</a><a href="#principles">Why UtilNexa</a><a href="#roadmap">Roadmap</a></div>
        <Link className="nav-cta" href="#products">Explore tools <ArrowRight size={15} /></Link>
      </nav>

      <section className="hero shell-width">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} /> The utility layer for modern work</div>
          <h1>Useful tools.<br /><em>Quietly excellent.</em></h1>
          <p>UtilNexa brings your everyday PDF, developer, data, and productivity work into fast, thoughtful tools that respect your attention and your data.</p>
          <div className="hero-actions"><Link className="primary-button" href="#products">Explore UtilNexa <ArrowRight size={16} /></Link><a className="text-link" href="#principles">Built privacy-first <ArrowRight size={15} /></a></div>
        </div>
        <div className="hero-card" aria-label="UtilNexa product overview">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="hero-card-inner"><span className="brand-mark large">U</span><strong>One calm place<br />for useful work.</strong><span className="hero-card-note">No noise. No unnecessary uploads.</span></div>
        </div>
      </section>

      <section id="products" className="products shell-width">
        <div className="section-heading"><div><span className="section-kicker">Explore the platform</span><h2>Tools for the work between the work.</h2></div><p>Start with the tools you need today. More focused utilities are on the way.</p></div>
        <div className="product-grid">{products.map((product) => { const Icon = product.icon; return <a className={`product-card ${product.tone}`} href={product.href} key={product.href}><div className="product-card-top"><span className="product-icon"><Icon size={21} /></span><ArrowRight className="product-arrow" size={19} /></div><span className="section-kicker">{product.label}</span><h3>{product.title}</h3><p>{product.description}</p><span className="product-link">Open workspace <ArrowRight size={15} /></span></a>; })}</div>
      </section>

      <section id="principles" className="principles shell-width"><div className="section-heading"><div><span className="section-kicker">The UtilNexa standard</span><h2>Designed to stay out of your way.</h2></div></div><div className="principle-grid"><div><LockKeyhole size={20} /><h3>Private by default</h3><p>Browser-local processing wherever possible. Sensitive input is not sent to a server just to transform it.</p></div><div><Check size={20} /><h3>Clear and dependable</h3><p>Useful output, honest boundaries, helpful errors, and no placeholder features presented as finished work.</p></div><div><Sparkles size={20} /><h3>Small surface area</h3><p>Each tool does one job well, with fast interactions and interfaces that feel familiar from the first click.</p></div></div></section>

      <section id="roadmap" className="roadmap shell-width"><div><span className="section-kicker">What is next</span><h2>A growing toolkit, one useful category at a time.</h2><p>We are building the practical utility layer for individuals and teams without turning it into another noisy dashboard.</p></div><div className="future-tools">{futureTools.map((tool) => <span key={tool}>{tool}</span>)}</div></section>

      <footer className="footer shell-width"><Link className="brand" href="/"><span className="brand-mark">U</span><span>UtilNexa</span></Link><span>Useful tools, thoughtfully built.</span><span>© {new Date().getFullYear()} UtilNexa</span></footer>
    </main>
  );
}
