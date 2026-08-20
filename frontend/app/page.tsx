import Link from "next/link";
import { ArrowRight, Layers, Repeat, Minimize2 } from "lucide-react";
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
      { name: "Organize Pages", href: "/tools/organize-pdf" }
    ]
  },
  {
    id: "convert-tools",
    title: "Convert",
    icon: Repeat,
    tools: [
      { name: "Image to PDF", href: "/tools/image-to-pdf" },
      { name: "PDF to Image", href: "/tools/pdf-to-image" }
    ]
  },
  {
    id: "optimize-tools",
    title: "Optimize",
    icon: Minimize2,
    tools: [{ name: "Compress PDF", href: "/tools/compress-pdf" }]
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
          Merge, split, organize, convert and compress PDFs. Processed
          privately on our servers and removed automatically — no account
          needed.
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
