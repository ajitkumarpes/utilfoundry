import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { DEVELOPER_URL, IMAGES_URL, PDF_URL } from "@/lib/links";

export const metadata: Metadata = { title: "Page not found" };

/**
 * The tools live on their own subdomains, so a missing page here is most often a tool
 * address typed against the wrong host: point at all three workspaces, not just home.
 */
export default function NotFound() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main" className="shell not-found">
        <p className="kicker">404 · Not found</p>
        <h1 className="section-title">That page is not on utilfoundry.com.</h1>
        <p className="section-lead">
          The tools each live in their own workspace. If you were looking for one, open its workspace and pick it
          from there.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/">Back to the home page <ArrowRight size={16} aria-hidden /></Link>
          <a className="btn btn-ghost" href={PDF_URL}>PDF tools</a>
          <a className="btn btn-ghost" href={DEVELOPER_URL}>Developer tools</a>
          <a className="btn btn-ghost" href={IMAGES_URL}>Image tools</a>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
