import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://images.utilfoundry.com"),
  title: {
    default: "UtilFoundry Images — Practical image tools",
    template: "%s — UtilFoundry Images"
  },
  description: "Compress, resize, convert and protect images with clear controls and predictable output.",
  openGraph: {
    title: "UtilFoundry Images",
    description: "Practical image tools, crafted well.",
    siteName: "UtilFoundry Images",
    url: "https://images.utilfoundry.com",
    type: "website"
  },
  robots: { index: true, follow: true }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1725" }
  ]
};

/**
 * Applied before paint so a reload in dark mode never flashes the light palette.
 * Reading localStorage can throw in locked-down browsers, hence the try/catch.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem("utilfoundry-theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
