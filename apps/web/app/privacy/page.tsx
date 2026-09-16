import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { CONTACT_EMAIL, DEVELOPER_URL, IMAGES_URL, PDF_URL } from "@/lib/links";
import { LAST_UPDATED, OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How UtilFoundry handles data across utilfoundry.com and its three tool workspaces, and where to find the specifics for each one.",
  alternates: { canonical: "/privacy" }
};

export default function PrivacyPage() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main" className="shell">
        <article className="legal-page">
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

          <p className="legal-lead">
            {OPERATOR} runs this site and three tool workspaces. None of them has accounts, analytics or advertising.
            This page covers utilfoundry.com itself and the parts that are common to all of them; because each
            workspace handles files differently, each has its own policy with the specifics.
          </p>

          <h2>Who we are</h2>
          <p>
            {OPERATOR} (&quot;we&quot;, &quot;us&quot;) is an independent project, and the data controller for the
            limited data described here. Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> about
            anything on this page. The same address is our grievance contact.
          </p>

          <h2>This page you are on</h2>
          <p>
            utilfoundry.com is a static site. It has no sign-up, no form, no comment box and no search that reaches
            us. We collect no name, email address or account detail, because there is nothing here to collect one
            with.
          </p>
          <ul>
            <li>No analytics, advertising or tracking script runs. There is no third-party script at all.</li>
            <li>We set no cookies.</li>
            <li>
              The only thing stored in your browser is <code>utilfoundry-theme</code>, holding the word{" "}
              <code>light</code> or <code>dark</code> so the page does not flash the wrong palette on reload. It never
              leaves your device.
            </li>
            <li>
              The page is served with a Content Security Policy that permits resources only from this site, so a
              third-party tracker cannot be loaded even by accident.
            </li>
            <li>
              Our web front end is not configured to write access logs, so we hold no stored record of your visit.
            </li>
          </ul>

          <h2>The tool workspaces</h2>
          <p>
            What happens to a file depends on which workspace you use, so each states its own position rather than
            hiding behind a single vague paragraph here:
          </p>
          <ul>
            <li>
              <strong>Developer tools</strong> — every tool runs in your browser; the app has no upload endpoint at
              all. <a href={`${DEVELOPER_URL}/privacy`}>Read its policy</a>.
            </li>
            <li>
              <strong>Image tools</strong> — most tools run in your browser. Six reach our own server, and its policy
              names them individually. <a href={`${IMAGES_URL}/privacy`}>Read its policy</a>.
            </li>
            <li>
              <strong>PDF tools</strong> — files are processed on our own server. Most are handled within the request;
              OCR and Office conversions run as background jobs and are held in temporary storage for up to an hour.{" "}
              <a href={`${PDF_URL}/privacy`}>Read its policy</a>.
            </li>
          </ul>
          <p>
            What is true everywhere: no account, no analytics, no advertising, no third-party AI service, and your
            files are never used to train any model or shared with anyone.
          </p>

          <h2>Your rights</h2>
          <p>
            Indian data protection law, and the GDPR where it applies to you, give you rights to access, correct and
            erase personal data held about you. We operate no account system and keep no profile, so in practice there
            is nothing of yours for us to produce or delete. If you believe otherwise, write to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will answer. You may also complain to your
            data protection authority.
          </p>

          <h2>Children</h2>
          <p>These sites are not directed at children, and we do not knowingly collect data from them.</p>

          <h2>Changes to this policy</h2>
          <p>If this policy changes in a way that matters, the date at the top of the page changes with it.</p>

          <h2>Contact</h2>
          <p>
            Questions about this policy go to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
