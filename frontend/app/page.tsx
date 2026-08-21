import Link from "next/link";
import { ArrowRight, Layers, Repeat, FileType, Minimize2, ShieldCheck } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const groups = [
  {
    id: "organize-tools",
    title: "Organize & Combine",
    icon: Layers,
    tools: [
      { name: "Merge PDF", href: "/tools/merge-pdf" },
      { name: "Split PDF", href: "/tools/split-pdf" },
      { name: "Organize Pages", href: "/tools/organize-pdf" },
      { name: "OCR PDF", href: "/tools/ocr-pdf" },
      { name: "Rotate PDF", href: "/tools/rotate-pdf" },
      { name: "Crop PDF", href: "/tools/crop-pdf" },
      { name: "Repair PDF", href: "/tools/repair-pdf" },
      { name: "Edit PDF Metadata", href: "/tools/edit-metadata" },
      { name: "Pages per Sheet", href: "/tools/pages-per-sheet" },
      { name: "Edit Bookmarks", href: "/tools/bookmarks-pdf" }
    ]
  },
  {
    id: "convert-tools",
    title: "Convert",
    icon: Repeat,
    tools: [
      { name: "Image to PDF", href: "/tools/image-to-pdf" },
      { name: "PDF to Image", href: "/tools/pdf-to-image" },
      { name: "PDF to Text", href: "/tools/pdf-to-text" },
      { name: "Text to PDF", href: "/tools/text-to-pdf" },
      { name: "Markdown to PDF", href: "/tools/markdown-to-pdf" },
      { name: "HTML to PDF", href: "/tools/html-to-pdf" }
    ]
  },
  {
    id: "office-tools",
    title: "Convert Office Files",
    icon: FileType,
    tools: [
      { name: "Word to PDF", href: "/tools/word-to-pdf" },
      { name: "Excel to PDF", href: "/tools/excel-to-pdf" },
      { name: "PowerPoint to PDF", href: "/tools/ppt-to-pdf" },
      { name: "PDF to Word", href: "/tools/pdf-to-word" },
      { name: "PDF to PowerPoint", href: "/tools/pdf-to-ppt" }
    ]
  },
  {
    id: "optimize-tools",
    title: "Optimize",
    icon: Minimize2,
    tools: [
      { name: "Compress PDF", href: "/tools/compress-pdf" },
      { name: "Grayscale PDF", href: "/tools/grayscale-pdf" },
      { name: "Extract Images", href: "/tools/extract-images" },
      { name: "Extract Links", href: "/tools/extract-links" },
      { name: "Extract Attachments", href: "/tools/extract-attachments" }
    ]
  },
  {
    id: "protect-tools",
    title: "Protect & Sign",
    icon: ShieldCheck,
    tools: [
      { name: "Add Watermark", href: "/tools/watermark-pdf" },
      { name: "Add Page Numbers", href: "/tools/page-numbers-pdf" },
      { name: "Lock PDF", href: "/tools/lock-pdf" },
      { name: "Unlock PDF", href: "/tools/unlock-pdf" },
      { name: "Sign PDF", href: "/tools/sign-pdf" },
      { name: "Redact PDF", href: "/tools/redact-pdf" },
      { name: "Sanitize PDF", href: "/tools/sanitize-pdf" },
      { name: "Flatten PDF", href: "/tools/flatten-pdf" },
      { name: "Header & Footer", href: "/tools/header-footer-pdf" }
    ]
  }
];

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
        <div className="group-grid">
          {groups.map(group => (
            <div className="group-card" id={group.id} key={group.id}>
              <div className="group-icon">
                <group.icon size={20} />
              </div>
              <h3>{group.title}</h3>
              <div className="tool-list">
                {group.tools.map(tool => (
                  <Link key={tool.name} href={tool.href}>
                    {tool.name}
                    <ArrowRight size={15} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
