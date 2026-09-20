import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UtilFoundry Admin",
  description: "Feedback and visitor analytics for the UtilFoundry apps.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
