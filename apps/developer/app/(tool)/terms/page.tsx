import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CONTACT_EMAIL } from "@/lib/links";
import { GOVERNING_LAW, LAST_UPDATED, OPERATOR } from "@/lib/legal";
import { TOOLS } from "@/lib/tools";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply to the free developer tools, and the specific things the payment and security tools are not.",
  alternates: { canonical: "/terms" }
};

export default function TermsPage() {
  return (
    <>
      <article className="legal-page">
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

        <p className="legal-lead">
          These terms apply when you use {OPERATOR} Developer Tools. Running a tool means you accept them. The section
          on what these tools are not is the one worth reading properly.
        </p>

        <h2>What this service is</h2>
        <p>
          {OPERATOR} Developer Tools is a set of {TOOLS.length} utilities that format, validate, convert, decode,
          diff, inspect and generate developer data. Everything runs in your browser, as described in the{" "}
          <Link href="/privacy">Privacy Policy</Link>. No account is required and nothing here is charged for.
        </p>

        <h2>Use masked test data</h2>
        <p>
          This is a public website, not a secure enclave. Do not paste live card numbers, real track data, PIN blocks,
          production signing keys, private keys or production credentials into any tool here. Your input stays in your
          browser, but a browser on a shared machine, a screen recording, a screenshot, a clipboard manager or a saved
          workspace can all outlive the tab. Use masked or synthetic test data.
        </p>

        <h2>What these tools are not</h2>
        <ul>
          <li>
            <strong>Not certification or compliance tooling.</strong> The ISO 8583 inspector reads a documented
            generic field profile. Real acquirer, issuer, network and scheme profiles change field definitions and
            encodings, so nothing here is Visa, Mastercard or any other scheme validation.
          </li>
          <li>
            <strong>Not an EMV interpreter.</strong> The TLV parser handles tag, length and value framing. It does not
            carry a versioned EMVCo tag dictionary, so it does not tell you what a transaction meant.
          </li>
          <li>
            <strong>Not key management.</strong> JWT signing uses a test secret that you type in. PIN blocks, CVV
            generation, production MAC keys and any HSM-backed operation are deliberately out of scope for a browser
            utility.
          </li>
          <li>
            <strong>Not a certificate tool.</strong> PEM inspection validates the block and its Base64 framing. It
            never exports private key material and does not replace a full X.509 or ASN.1 tool.
          </li>
          <li>
            <strong>Not a data loss control.</strong> The sensitive-input warning is advisory, computed locally, and
            misses things.
          </li>
          <li>
            <strong>Not a request client.</strong> The cURL and fetch builders generate text. They never send a
            request.
          </li>
          <li>
            <strong>Not an authority on a single code page.</strong> The EBCDIC decoder uses IBM037. Other host
            variants need their own code page before their bytes mean anything.
          </li>
        </ul>

        <h2>Check the output before you rely on it</h2>
        <p>
          These are diagnostic utilities. A formatter can reshape something you did not intend, a converter can lose
          precision a format cannot carry, and a generated value is only as good as the input you gave it. Verify
          anything that is going near production.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>Do not use these tools to attack, probe or process data you have no right to.</li>
          <li>Do not attempt to disrupt or overload the service, or to reach any part of it you were not given.</li>
          <li>
            Very large inputs are limited by your own browser rather than by us; a tab that runs out of memory is the
            expected outcome, not a fault to report.
          </li>
        </ul>

        <h2>No warranty</h2>
        <p>
          The service is provided &quot;as is&quot; and &quot;as available&quot;, without warranty of any kind,
          express or implied, including merchantability and fitness for a particular purpose. We do not promise a tool
          is error-free, uninterrupted, or correct for your case.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent the law allows, we are not liable for any indirect, incidental or consequential loss
          arising from your use of this service, including loss of data or any decision made on the strength of a
          tool&apos;s output.
        </p>

        <h2>Availability</h2>
        <p>
          We may change, suspend or withdraw any tool at any time and without notice. These are free tools with no
          service level attached.
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
      <SiteFooter />
    </>
  );
}
