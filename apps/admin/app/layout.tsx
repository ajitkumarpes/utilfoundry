import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "UtilFoundry Admin", template: "%s — UtilFoundry Admin" },
  description: "Feedback and visitor analytics for the UtilFoundry apps.",
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" }
  ]
};

/** Applied before paint so a reload never flashes the other theme. Storage can throw. */
const THEME_SCRIPT = `try{var t=localStorage.getItem("uf-admin-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The proxy puts a fresh nonce on every page request; without it the CSP blocks this script.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
