import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://images.utilfoundry.com"),
  title: "UtilFoundry Images — Practical image tools",
  description: "Compress, resize, convert and protect images with clear controls and predictable output.",
  openGraph: { title: "UtilFoundry Images", description: "Practical image tools, crafted well.", siteName: "UtilFoundry Images", url: "https://images.utilfoundry.com", type: "website" },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
