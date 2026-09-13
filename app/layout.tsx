import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://utilfoundry.com"),
  title: "UtilFoundry — practical tools, crafted well",
  description: "Privacy-first PDF, developer, data, and productivity tools for everyday work.",
  openGraph: {
    title: "UtilFoundry — practical tools, crafted well",
    description: "A calm, privacy-first home for tools that help you get work done.",
    url: "https://utilfoundry.com",
    siteName: "UtilFoundry",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
