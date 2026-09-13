import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ToolCatalog from "@/components/ToolCatalog";

export default function Home() {
  return (
    <main>
      <SiteHeader />

      <section className="hero">
        <div className="eyebrow">PDF Toolbox</div>
        <h1>
          Every PDF task,
          <br />
          <em>handled in seconds.</em>
        </h1>
        <p>
          Merge, split, organize, OCR, convert, compress, watermark, lock,
          sign and redact PDFs — plus Word, Excel and PowerPoint conversion.
          Processed privately on our servers and removed automatically — no
          account needed.
        </p>
        <div className="hero-actions">
          <Link href="/tools/merge-pdf" className="primary-btn">
            Start with Merge PDF <ArrowRight size={18} />
          </Link>
          <a href="#organize-tools" className="secondary-btn">
            Explore tools
          </a>
        </div>
      </section>

      <section id="tools" className="tool-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Toolbox</div>
            <h2>Everything you need for PDFs.</h2>
          </div>
        </div>
        <ToolCatalog />
      </section>
      <SiteFooter />
    </main>
  );
}
