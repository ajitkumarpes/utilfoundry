import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CONTACT_EMAIL } from "@/lib/links";
import { LAST_UPDATED, OPERATOR } from "@/lib/legal";
import { TOOLS } from "@/lib/tools";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Every developer tool runs in your browser. This page explains what that means, and the two things this site stores on your device.",
  alternates: { canonical: "/privacy" }
};

export default function PrivacyPage() {
  return (
    <>
      <article className="legal-page">
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

        <p className="legal-lead">
          All {TOOLS.length} tools on this site run inside your browser. Whatever you paste into a tool is processed
          by JavaScript on the page you already have open, and is never sent to us, because there is nothing here to
          send it to.
        </p>

        <h2>Who we are</h2>
        <p>
          These tools are operated by {OPERATOR} (&quot;we&quot;, &quot;us&quot;), an independent project. You can
          reach us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> about anything on this page.
        </p>

        <h2>Your input never leaves your browser</h2>
        <p>This is a structural fact about the app, not a policy we could quietly change:</p>
        <ul>
          <li>
            The application has no upload endpoint. There is no API route, no server action and no form that posts
            your input anywhere.
          </li>
          <li>
            Formatting, validating, encoding, decoding, diffing, parsing and generating all happen in the page. The
            libraries that do it are downloaded to your browser and run there.
          </li>
          <li>
            The page is served with a Content Security Policy whose <code>connect-src</code> allows only this site
            and <code>admin.utilfoundry.com</code> — the feedback and visit signal described below. It cannot reach
            anywhere else, even if something on the page tried to.
          </li>
          <li>
            A page you already have open keeps working with the network disconnected, which is the plainest
            demonstration that nothing is being sent.
          </li>
        </ul>

        <h2>No account. An optional feedback button, and one anonymous visit signal.</h2>
        <p>
          There is no sign-up, so we collect no name or email address. No third-party analytics, advertising or
          tracking script runs here — nothing from Google, Meta, an ad network or a data broker. Two things we built
          ourselves run only against our own <code>admin.utilfoundry.com</code>, never a third party:
        </p>
        <ul>
          <li>
            <strong>The &quot;Give feedback&quot; button</strong> is entirely voluntary. If you open it and press
            Submit, we store what you typed — your message, an optional star rating, and which tool you were on if
            you leave &quot;include tool details&quot; checked. Nothing is sent unless you press Submit, and none of
            it is the JSON, YAML or other input you were formatting.
          </li>
          <li>
            <strong>An anonymous visit signal</strong> is sent for each page you view: which page, and a coarse
            location (country, region, city) resolved from your IP address by an offline lookup table we run
            ourselves. Your IP address itself is never stored. <code>admin.utilfoundry.com</code> sets one cookie —
            a random id, not your identity — so a repeat visit can be told from a new one; this site itself does not
            set or read that cookie.
          </li>
        </ul>

        <h2>What is stored on your device</h2>
        <p>Two items, both in your browser&apos;s local storage, both invisible to us:</p>
        <ul>
          <li>
            <code>utilfoundry-theme</code> holds the word <code>light</code> or <code>dark</code>, so the page does
            not flash the wrong palette when it reloads.
          </li>
          <li>
            <code>utilfoundry-dev-workspace</code> is written <strong>only when you press Save workspace</strong>. It
            holds the current tool, your input and the option fields, so you can come back to them. Exporting a
            workspace writes the same content to a file you choose. Both stay on your machine, and clearing site data
            removes the saved workspace with it.
          </li>
        </ul>
        <p>
          On a shared or public computer, treat a saved workspace the way you would treat any other file you left
          behind: use Reset, or clear the site data, before you walk away.
        </p>

        <h2>Sensitive input</h2>
        <p>
          Some tools here handle material that is sensitive by nature — tokens, keys, certificates, card data and
          payment protocol payloads. Running a tool checks your input for patterns that look like such material and
          shows a warning. That check is a courtesy reminder computed in your browser: it is not a data loss control,
          it does not catch everything, and nothing about it is reported to us. Use masked test data.
        </p>

        <h2>Server records</h2>
        <p>
          Our servers deliver the page and its assets, and nothing else. The front end is not configured to write
          access logs, so there is no stored record tying an IP address to your use of a tool. No request carries your
          input, so no log could contain it.
        </p>

        <h2>Your rights</h2>
        <p>
          Indian data protection law, and the GDPR where it applies to you, give you rights to access, correct and
          erase personal data held about you. We hold none: there is no account, no profile and no server-side record
          of your activity here. If you think otherwise, write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will answer. The same address is our
          grievance contact, and you may also complain to your data protection authority.
        </p>

        <h2>Children</h2>
        <p>This site is not directed at children, and we do not knowingly collect data from them.</p>

        <h2>Changes to this policy</h2>
        <p>If this policy changes in a way that matters, the date at the top of the page changes with it.</p>

        <h2>Contact</h2>
        <p>
          Questions about this policy go to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
