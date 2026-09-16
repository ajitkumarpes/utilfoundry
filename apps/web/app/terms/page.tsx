import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { CONTACT_EMAIL, DEVELOPER_URL, IMAGES_URL, PDF_URL } from "@/lib/links";
import { GOVERNING_LAW, LAST_UPDATED, OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply across utilfoundry.com and its three tool workspaces, and where each workspace adds its own.",
  alternates: { canonical: "/terms" }
};

export default function TermsPage() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main" className="shell">
        <article className="legal-page">
          <h1>Terms of Service</h1>
          <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

          <p className="legal-lead">
            These terms apply to utilfoundry.com and, as a baseline, to every {OPERATOR} workspace. Each workspace
            adds terms for the tools it actually runs, and those sit alongside these rather than replacing them.
          </p>

          <h2>What this service is</h2>
          <p>
            {OPERATOR} publishes free browser tools across three workspaces: PDF, developer and image. No account is
            required and nothing is charged for. Where the work happens is set out in the{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>

          <h2>The workspace terms</h2>
          <ul>
            <li><a href={`${PDF_URL}/terms`}>PDF tools terms</a></li>
            <li><a href={`${DEVELOPER_URL}/terms`}>Developer tools terms</a></li>
            <li><a href={`${IMAGES_URL}/terms`}>Image tools terms</a></li>
          </ul>

          <h2>Your content is your responsibility</h2>
          <p>
            You must have the right to use and process whatever you put into these tools, and you must not use them
            for unlawful material or to process someone else&apos;s personal data without a lawful basis for doing so.
          </p>

          <h2>Acceptable use</h2>
          <ul>
            <li>Do not attempt to disrupt or overload any part of the service, or to reach any part you were not given.</li>
            <li>Do not script or automate bulk use of the server-backed tools; they are sized for people, not pipelines.</li>
            <li>Each workspace enforces its own size and rate limits, and those limits are part of these terms.</li>
          </ul>

          <h2>Our content</h2>
          <p>
            The name {OPERATOR}, the mark, the site design and its copy belong to us. The tools are free to use; that
            does not license the branding. What you put into a tool, and what comes out of it, stays yours — we claim
            no rights over it.
          </p>

          <h2>No warranty</h2>
          <p>
            The service is provided &quot;as is&quot; and &quot;as available&quot;, without warranty of any kind,
            express or implied, including merchantability and fitness for a particular purpose. We do not promise a
            tool will be error-free, uninterrupted, or right for your case.
          </p>

          <h2>Limitation of liability</h2>
          <p>
            To the fullest extent the law allows, we are not liable for any indirect, incidental or consequential loss
            arising from your use of this service, including loss of a file or of any work in it. Keep your own copy
            of anything before you process it here.
          </p>

          <h2>Availability</h2>
          <p>
            We may change, suspend or withdraw any tool or workspace at any time and without notice. These are free
            tools with no service level attached.
          </p>

          <h2>Changes to these terms</h2>
          <p>If these terms change in a way that matters, the date at the top of the page changes with it.</p>

          <h2>Governing law</h2>
          <p>
            These terms are governed by the laws of {GOVERNING_LAW}, and the courts of {GOVERNING_LAW} have exclusive
            jurisdiction over any dispute arising from them.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms go to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
