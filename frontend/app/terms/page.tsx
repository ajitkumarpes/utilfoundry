import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply to using UtilFoundry PDF's free PDF tools."
};

export default function TermsPage() {
  return (
    <main>
      <SiteHeader />
      <article className="legal-page">
        <h1>Terms of Service</h1>
        <p className="updated">Last updated: 20 August 2026</p>

        <p>
          These terms apply when you use UtilFoundry PDF (part of the UtilFoundry toolbox, &quot;we&quot;, &quot;us&quot;) at
          this website. By uploading a file or using a tool here, you agree to them.
        </p>

        <h2>What this service is</h2>
        <p>
          UtilFoundry PDF offers free, browser-based tools for working with PDF files — merging, splitting, converting,
          compressing, watermarking, signing, redacting, and similar operations. No account is required and there
          is no charge to use any tool listed on this site.
        </p>

        <h2>Your files, your responsibility</h2>
        <p>
          You&apos;re responsible for the files you upload and for having the right to upload and process them.
          Don&apos;t use this service for content you don&apos;t have the rights to, or for anything illegal.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>Files are limited to 50MB each (100MB per request across multiple files).</li>
          <li>
            Requests are rate-limited per IP address to keep the service usable for everyone. Automated or
            large-scale scraping/bulk use that circumvents this limit isn&apos;t permitted.
          </li>
          <li>Don&apos;t use this service to attempt to disrupt, overload, or gain unauthorized access to it.</li>
        </ul>

        <h2>Tool-specific notes worth knowing</h2>
        <ul>
          <li>
            <strong>Sign PDF</strong> places a visual signature image onto the page. It is <strong>not</strong> a
            certified digital signature and has no cryptographic verification — don&apos;t rely on it where a
            legally certified e-signature is required.
          </li>
          <li>
            <strong>Redact PDF</strong> removes the underlying text/image content in the area you mark, not just a
            visual overlay. Content nested inside certain complex, design-tool-generated layouts may not be fully
            caught — review the result before relying on it for sensitive documents.
          </li>
          <li>
            <strong>PDF ↔ Word/PowerPoint conversion</strong> relies on an open-source conversion engine. Complex
            layouts, fonts, or formatting may not convert perfectly.
          </li>
        </ul>

        <h2>No warranty</h2>
        <p>
          This service is provided &quot;as is,&quot; without warranties of any kind, express or implied, including
          fitness for a particular purpose. We don&apos;t guarantee the tools will be error-free, uninterrupted, or
          produce a perfect result for every file.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential
          damages arising from your use of this service, including loss of data or loss of a file you processed
          here. Keep your own backup of any file before you upload it.
        </p>

        <h2>Availability</h2>
        <p>
          We may change, suspend, or discontinue any tool, or apply usage limits, at any time without prior notice.
        </p>

        <h2>Changes to these terms</h2>
        <p>If these terms change in a way that matters, we&apos;ll update the date at the top of this page.</p>

        <h2>Governing law</h2>
        <p>These terms are governed by the laws of <strong>[JURISDICTION — to be filled in]</strong>.</p>

        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent to <strong>[CONTACT_EMAIL — to be filled in]</strong>.
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}
