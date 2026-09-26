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
            {OPERATOR} runs this site and three tool workspaces. None of them has accounts, third-party analytics or
            advertising. This page covers utilfoundry.com itself and the parts that are common to all of them;
            because each workspace handles files differently, each has its own policy with the specifics.
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
            <li>
              No third-party analytics, advertising or tracking script runs — nothing from Google, Meta, an ad
              network or a data broker.
            </li>
            <li>
              <strong>The &quot;Give feedback&quot; button</strong>, on every page, is voluntary. If you open it and
              press Submit, we store what you typed — your message, an optional star rating, and which category you
              chose. Nothing is sent unless you press Submit.
            </li>
            <li>
              <strong>An anonymous visit signal</strong> is sent for each page you view: which page, and a coarse
              location (country, region, city) resolved from your IP address by an offline lookup table we run
              ourselves. Your IP address itself is never stored.
            </li>
            <li>
              Both go only to our own <code>admin.utilfoundry.com</code>, never a third party. That subdomain sets
              one cookie — a random id, not your identity, used only to tell a repeat visit from a new one. This site
              itself sets no cookie of its own; the only thing it keeps in your browser is{" "}
              <code>utilfoundry-theme</code>, in local storage, holding the word <code>light</code> or{" "}
              <code>dark</code> so the page does not flash the wrong palette on reload. It never leaves your device.
            </li>
            <li>
              The page is served with a Content Security Policy whose <code>connect-src</code> permits only this
              site and <code>admin.utilfoundry.com</code>, so nothing else can be loaded or contacted even by
              accident.
            </li>
            <li>
              Our web front end is not configured to write access logs, so we hold no stored record of your visit
              beyond the anonymous signal above.
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
            What is true everywhere: no account, no third-party analytics, no advertising, no third-party AI
            service, and your files are never used to train any model or shared with anyone. Every workspace also
            has the same optional feedback button and anonymous visit signal described above, going only to our own{" "}
            <code>admin.utilfoundry.com</code>.
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
