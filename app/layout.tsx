import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://utilnexa.com"),
  title: "UtilNexa — useful tools, thoughtfully built",
  description: "Privacy-first PDF, developer, data, and productivity tools for everyday work.",
  openGraph: {
    title: "UtilNexa — useful tools, thoughtfully built",
    description: "A calm, privacy-first home for tools that help you get work done.",
    url: "https://utilnexa.com",
    siteName: "UtilNexa",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
