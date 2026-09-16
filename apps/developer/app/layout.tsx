import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dev.utilfoundry.com"),
  title: {
    default: "UtilFoundry Developer Tools — Private, browser-side utilities",
    template: "%s — UtilFoundry Developer Tools"
  },
  description: "Fast, private developer utilities that run in your browser: formatters, validators, converters and payment inspectors.",
  openGraph: {
    title: "UtilFoundry Developer Tools",
    description: "Private developer utilities that run in your browser.",
    siteName: "UtilFoundry Developer Tools",
    url: "https://dev.utilfoundry.com",
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
