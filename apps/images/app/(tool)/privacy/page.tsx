import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CONTACT_EMAIL } from "@/lib/links";
import { BROWSER_TOOL_NAMES, LAST_UPDATED, OPERATOR, SHARP_TOOL_NAMES, WORKER_TOOL_NAMES } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Exactly which image tools stay in your browser, which ones reach our server, and what happens to the file when they do.",
  alternates: { canonical: "/privacy" }
};

export default function PrivacyPage() {
  return (
    <div className="page-inner">
      <article className="legal-page">
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

        <p className="legal-lead">
          {OPERATOR} Images is a set of free image tools. There is no account, no third-party tracking and no
          advertising. Most tools finish inside your browser and the image never reaches us at all. The ones that do
          need a server are named below, tool by tool, rather than left for you to guess.
        </p>

        <h2>Who we are</h2>
        <p>
          These tools are operated by {OPERATOR} (&quot;we&quot;, &quot;us&quot;), an independent project. We decide how
          the limited data described below is handled, so we are the data controller for it. You can reach us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> about anything on this page.
        </p>

        <h2>No account, no sign-up</h2>
        <p>
          You do not register or log in to use any tool here. We do not collect a name, an email address or any
          other account detail, because there is no account to attach one to.
        </p>

        <h2>Where each tool actually runs</h2>
        <p>
          This is the part that matters, so it is set out tool by tool. Every tool page also carries a badge that
          says <strong>Runs in your browser</strong> or <strong>Server-local processing</strong> before you upload
          anything.
        </p>

        <h3>Stays in your browser</h3>
        <p>
          These tools decode and redraw the image on a canvas inside the page. The file is never sent to us, and a
          page you already have open keeps working with the network disconnected.
        </p>
        <p className="legal-tools">{BROWSER_TOOL_NAMES.join(", ")}.</p>
        <p>
          <strong>One exception.</strong> Browsers cannot write AVIF or TIFF. If you ask one of the tools above for
          AVIF or TIFF output, the finished image is sent to our server purely to be re-encoded into that format,
          and is handled exactly like the uploads described below. Choosing PNG, JPG or WebP keeps everything local.
        </p>

        <h3>Sent to our own server</h3>
        <p>
          These re-encode the file with libvips inside the same application that served you the page. No third party
          is involved.
        </p>
        <p className="legal-tools">{SHARP_TOOL_NAMES.join(", ")}.</p>

        <h3>Sent to our own server and its OCR and model worker</h3>
        <p>
          These pass the image to a second service of ours on the same private network, which runs the OCR engine and
          the two machine-learning models. That worker is not reachable from the internet and calls nothing outside.
        </p>
        <p className="legal-tools">{WORKER_TOOL_NAMES.join(", ")}.</p>
        <p>
          <strong>Screen capture.</strong> Screenshot to Text captures your screen through your browser, with your
          permission, and then uploads that capture for OCR. Treat it like uploading a photograph of your screen.
          Screenshot to PDF also captures your screen, but assembles the PDF in the page, so that capture is never
          uploaded.
        </p>

        <h2>What happens to an upload</h2>
        <ul>
          <li>It is held in memory for the length of the request and is not written to any database or file store.</li>
          <li>
            In the worker, an upload larger than 1 MB may be buffered in a temporary file. That directory is a
            memory-backed filesystem, so it is never written to a disk, and it is released when the request ends.
          </li>
          <li>Every response carries <code>Cache-Control: no-store</code>, so the result is not cached on the way back to you.</li>
          <li>Once the result has been returned, no reusable copy of your image remains.</li>
          <li>
            Uploads are capped at 32 MB and 40 megapixels per file so that a single request cannot exhaust the server.
          </li>
        </ul>

        <h2>The models are ours and run here</h2>
        <p>
          The worker tools listed above use models that ship inside our own container and run on our own hardware.
          Your image is not sent to any AI provider, and it is never used to train or fine-tune any model, ours or
          anyone else&apos;s.
        </p>

        <h2>Feedback, visit signals, cookies and third parties</h2>
        <ul>
          <li>
            No third-party analytics, advertising or tracking scripts run on this site — nothing from Google, Meta,
            an ad network or a data broker.
          </li>
          <li>
            <strong>The &quot;Give feedback&quot; button</strong> is voluntary. If you open it and press Submit, we
            store what you typed — your message, an optional star rating, and which tool you were on if you leave
            &quot;include tool details&quot; checked. It never includes an image you uploaded, and nothing is sent
            unless you press Submit.
          </li>
          <li>
            <strong>An anonymous visit signal</strong> is sent for each page you view: which page, and a coarse
            location (country, region, city) resolved from your IP address by an offline lookup table we run
            ourselves. Your IP address itself is never stored.
          </li>
          <li>
            Both of those go only to our own <code>admin.utilfoundry.com</code>, never a third party. That
            subdomain sets one cookie — a random id, not your identity, used only to tell a repeat visit from a new
            one. This site itself sets no cookie of its own; the only thing stored in your browser directly is{" "}
            <code>utilfoundry-theme</code>, which holds the word <code>light</code> or <code>dark</code> so the page
            does not flash the wrong palette on reload.
          </li>
          <li>
            The page is served with a Content Security Policy whose <code>connect-src</code> allows only this site
            and <code>admin.utilfoundry.com</code>, so nothing else can be loaded or contacted even by accident.
          </li>
          <li>We do not sell, rent or share your files or any data about you.</li>
        </ul>

        <h2>Server records and your IP address</h2>
        <p>
          To keep the tools available for everyone, uploads are throttled per connection. Doing that means holding
          your IP address in server memory for a rolling minute and counting requests against it. That count is all
          it is used for: it is never written to disk, never attached to a file you processed, and never used to
          identify you or build a profile. It disappears as soon as the minute passes.
        </p>
        <p>
          Beyond that, our web front end is not configured to write access logs, so there is no stored record tying
          an IP address to a file you processed. Our services can still print ordinary operational messages, such as
          an error when a file cannot be decoded; those describe the fault, not you.
        </p>

        <h2>Security</h2>
        <p>
          Traffic to this site uses HTTPS. Each service runs with no-new-privileges set and a fixed memory and CPU
          ceiling, and the worker has no route to the internet. No system is perfect, but nothing in the design keeps
          your image any longer than the request that asked for it.
        </p>

        <h2>Your rights</h2>
        <p>
          Indian data protection law, and the GDPR where it applies to you, give you rights to access, correct and
          erase personal data held about you. We hold no account, no profile and no stored file, so in practice there
          is nothing of yours for us to produce or delete. If you believe we hold something about you, write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will answer. The same address is our
          grievance contact, and you may also complain to your data protection authority.
        </p>

        <h2>Children</h2>
        <p>This site is not directed at children, and we do not knowingly collect data from them.</p>

        <h2>Changes to this policy</h2>
        <p>
          If this policy changes in a way that matters, the date at the top of the page changes with it. Because the
          tool lists above are generated from the live catalogue, a new tool appears here the moment it appears in the
          app.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy, or about a specific tool, go to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </article>
      <SiteFooter />
    </div>
  );
}
