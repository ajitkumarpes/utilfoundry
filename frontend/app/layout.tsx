import "./globals.css";
import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PDFLab — Free Online PDF Tools",
    template: "%s | PDFLab"
  },
  description:
    "Merge, split, compress, convert, OCR, watermark, sign and redact PDFs — 22 free tools, processed privately and removed automatically. No account needed.",
  openGraph: {
    title: "PDFLab — Free Online PDF Tools",
    description: "22 free PDF tools. Private by default. No account needed.",
    siteName: "PDFLab",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "PDFLab — Free Online PDF Tools",
    description: "22 free PDF tools. Private by default. No account needed."
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
