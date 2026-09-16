import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CONTACT_EMAIL } from "@/lib/links";
import { GOVERNING_LAW, LAST_UPDATED, OPERATOR } from "@/lib/legal";
import { GENERAL_LIMIT, WORKER_LIMIT } from "@/lib/rate-limit";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply to the free image tools, including the limits each one enforces and what the model-backed tools do not promise.",
  alternates: { canonical: "/terms" }
};

export default function TermsPage() {
  return (
    <div className="page-inner">
      <article className="legal-page">
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

        <p className="legal-lead">
          These terms apply when you use {OPERATOR} Images. Opening a tool and processing an image means you accept
          them. They are short because the service is simple: free tools, no account, no promises we cannot keep.
        </p>

        <h2>What this service is</h2>
        <p>
          {OPERATOR} Images offers free tools for compressing, resizing, cropping, converting, watermarking and
          inspecting images, plus OCR, background removal and upscaling. No account is required and nothing on this
          site is charged for. Where each tool runs is set out in the{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>

        <h2>Your images are your responsibility</h2>
        <p>
          You must have the right to use and process every image you put into these tools. Do not use this service
          for material you do not hold the rights to, for unlawful content, or to process someone else&apos;s personal
          data without a lawful basis for doing so.
        </p>

        <h2>Limits the service enforces</h2>
        <p>These are the actual limits in the code, not guidelines:</p>
        <ul>
          <li>32 MB and 40 megapixels per file, on both the server and the worker.</li>
          <li>Up to 20 images at a time in the batch tools.</li>
          <li>Image Upscaler accepts images up to 12 megapixels and will not produce more than 48 megapixels, so 8x is refused on all but small images.</li>
          <li>OCR scales the longest side down to 3,200 pixels before reading, which is a quality trade made for speed and reliability.</li>
          <li>A server request that has not finished within about a minute is abandoned.</li>
          <li>
            Uploads are throttled per connection: {GENERAL_LIMIT} a minute overall, and {WORKER_LIMIT} a minute for
            the OCR and model tools, which cost far more to run. Both leave ample room for the batch sizes above and
            are there to stop automated abuse, not you.
          </li>
        </ul>

        <h2>Acceptable use</h2>
        <ul>
          <li>Do not script or automate bulk use of the server-backed tools; they are sized for people, not pipelines.</li>
          <li>Do not attempt to disrupt or overload the service, or to reach any part of it you were not given.</li>
          <li>Do not use the tools to strip metadata, ownership marks or watermarks from work that is not yours.</li>
        </ul>

        <h2>What the tools do and do not promise</h2>
        <ul>
          <li>
            <strong>Background Removal, Image Upscaler, OCR Image and Screenshot to Text</strong> are automated model
            output. The cutout can miss hair and fine edges, the upscaler invents detail that was not in the original,
            and OCR misreads text — handwriting especially, and any language whose pack is not installed. Check the
            result before relying on it.
          </li>
          <li>
            <strong>Remove Metadata</strong> removes metadata such as EXIF, GPS and camera fields. It does not change
            what the picture shows: anything visible in the pixels, including a face or a screen full of text, is
            still there afterwards.
          </li>
          <li>
            <strong>Image Compressor</strong> is lossy at any quality below 100, and will return your original file
            untouched when re-encoding would only make it larger.
          </li>
          <li>
            <strong>Format conversion</strong> cannot add what a format does not carry. JPG has no transparency, so
            transparent areas are filled with white, and a palette format loses colours.
          </li>
        </ul>

        <h2>No warranty</h2>
        <p>
          The service is provided &quot;as is&quot; and &quot;as available&quot;, without warranty of any kind, express
          or implied, including merchantability and fitness for a particular purpose. We do not promise that a tool
          will be error-free, uninterrupted, or right for every file.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent the law allows, we are not liable for any indirect, incidental or consequential loss
          arising from your use of this service, including loss of an image or of the work in it. Keep your own copy
          of anything before you process it here.
        </p>

        <h2>Availability</h2>
        <p>
          We may change, suspend or withdraw any tool, or impose limits, at any time and without notice. These are
          free tools with no service level attached.
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
    </div>
  );
}
