import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/** A real typeface, self-hosted by next/font so there is no third-party request. */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://utilfoundry.com"),
  title: "UtilFoundry — practical tools, crafted well",
  description: "Privacy-first PDF, image and developer tools for everyday work. Most of them run in your browser, so your files stay with you.",
  openGraph: {
    title: "UtilFoundry — practical tools, crafted well",
    description: "A calm, privacy-first home for tools that help you get work done.",
    url: "https://utilfoundry.com",
    siteName: "UtilFoundry",
    type: "website"
  },
  robots: { index: true, follow: true }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b121e" }
  ]
};

/**
 * Applied before paint so a reload in dark mode never flashes the light palette.
 * The same storage key as the tool apps, so a visitor's theme carries across
 * utilfoundry.com and its subdomains in the same browser.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem("utilfoundry-theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
