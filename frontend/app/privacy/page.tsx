import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How PDFLab handles the files and data you give it."
};

export default function PrivacyPage() {
  return (
    <main>
      <SiteHeader />
      <article className="legal-page">
        <h1>Privacy Policy</h1>
        <p className="updated">Last updated: 20 August 2026</p>

        <p>
          PDFLab (part of the UtilNexa toolbox, &quot;we&quot;, &quot;us&quot;) provides free PDF tools at this
          website. This page explains what happens to your files and any other data when you use them.
        </p>

        <h2>No account, no sign-up</h2>
        <p>
          You don&apos;t need to register or log in to use any tool on this site. We don&apos;t collect names,
          email addresses, or any other account information, because there is no account.
        </p>

        <h2>How your files are handled</h2>
        <p>Tools work in one of two ways, and it changes how your file is handled:</p>
        <ul>
          <li>
            <strong>Most tools</strong> (Merge, Split, Organize, Rotate, Crop, Compress, Watermark, Page Numbers,
            Lock PDF, Unlock, Grayscale, Extract Images, Sign, Redact, Image ↔ PDF) process your file
            during the request. Most stay in memory; Merge may use operating-system temporary files, which are
            deleted immediately after the request completes. Once the result is returned, PDFLab does not retain a
            reusable copy of the upload.
          </li>
          <li>
            <strong>OCR and Office conversions</strong> (Word, Excel, PowerPoint ↔ PDF) run as a background job, so
            your uploaded file and the converted result are held in temporary storage while the job runs. That
            storage becomes eligible for permanent deletion after <strong>1 hour</strong> and scheduled cleanup runs
            every 15 minutes, whether or not you downloaded the result.
          </li>
        </ul>
        <p>
          We do not read, scan, review, or use the contents of your files for any purpose other than performing the
          conversion or edit you asked for.
        </p>

        <h2>Technical data</h2>
        <p>
          To keep the service available for everyone, requests are throttled per IP address to prevent abuse. This
          means your IP address is briefly held in server memory to enforce that limit; it is not logged
          permanently, sold, or linked to your files.
        </p>

        <h2>What we don&apos;t do</h2>
        <ul>
          <li>No third-party analytics, advertising, or tracking scripts run on this site.</li>
          <li>We don&apos;t sell, rent, or share your files or data with anyone.</li>
          <li>We don&apos;t use your files to train any AI or machine learning model.</li>
          <li>This site does not process payments or store payment information — every tool here is free.</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          We don&apos;t set advertising or tracking cookies. Your browser may still handle standard technical
          mechanisms (such as caching) needed simply to load the page.
        </p>

        <h2>Security</h2>
        <p>
          File uploads are capped at 50MB per file to keep processing reliable. Traffic to this site should always
          use HTTPS. No system is perfectly secure, but nothing about our design is meant to keep your files around
          longer than necessary to do the job you asked for.
        </p>

        <h2>Children&apos;s privacy</h2>
        <p>This site is not directed at children and we do not knowingly collect data from children.</p>

        <h2>Changes to this policy</h2>
        <p>
          If this policy changes in a way that matters, we&apos;ll update the date at the top of this page.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy or a request about your data can be sent to{" "}
          <strong>[CONTACT_EMAIL — to be filled in]</strong>.
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}
