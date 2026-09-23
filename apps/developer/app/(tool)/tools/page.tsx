import type { Metadata } from "next";
import { Suspense } from "react";
import { AllTools, AllToolsView } from "@/components/AllTools";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PARENT_URL } from "@/lib/links";
import { TOOLS } from "@/lib/tools";

export const metadata: Metadata = {
  title: "All developer tools",
  description: `${TOOLS.length} private developer tools that run in your browser: formatters, validators, converters, encoders and payment inspectors.`,
  alternates: { canonical: "/tools" }
};

export default function AllToolsPage() {
  return (
    <>
      <div className="crumb-row">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <a href={PARENT_URL}>UtilFoundry</a>
          <span aria-hidden>/</span>
          <span aria-current="page">Developer tools</span>
        </nav>
      </div>
      <div className="catalog-hero">
        <h1>Developer tools</h1>
        <p>{TOOLS.length} tools for formatting, validating, converting and inspecting data — each one runs entirely in your browser.</p>
      </div>
      {/* The fallback is the full "all" grid, so the prerendered page lists every tool. */}
      <Suspense fallback={<AllToolsView view="all" />}>
        <AllTools />
      </Suspense>
      <SiteFooter />
    </>
  );
}
