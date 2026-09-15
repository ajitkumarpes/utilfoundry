import "./globals.css";
import type { Metadata } from "next";
import { TOOL_COUNT } from "@/lib/tools";
import { THEME_COOKIE, THEMES } from "@/lib/theme";

// Applies the saved theme cookie to <html> before first paint, so pages stay
// statically prerenderable (no server-side cookie read forcing dynamic
// rendering) while still avoiding a flash of the default theme.
const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]+)/);var v=m&&decodeURIComponent(m[1]);if(${JSON.stringify(THEMES.map(t => t.id))}.indexOf(v)>-1){document.documentElement.setAttribute('data-theme',v)}}catch(e){}})();`;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "UtilFoundry PDF — Free Online PDF Tools",
    template: "%s | UtilFoundry PDF"
  },
  description:
    `Merge, split, compress, convert, OCR, watermark, sign and redact PDFs — ${TOOL_COUNT} free tools, processed privately and removed automatically. No account needed.`,
  openGraph: {
    title: "UtilFoundry PDF — Free Online PDF Tools",
    description: `${TOOL_COUNT} free PDF tools. Private by default. No account needed.`,
    siteName: "UtilFoundry PDF",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "UtilFoundry PDF — Free Online PDF Tools",
    description: `${TOOL_COUNT} free PDF tools. Private by default. No account needed.`
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
