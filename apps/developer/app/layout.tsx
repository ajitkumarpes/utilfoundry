import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UtilFoundry Developer Tools",
  description: "Fast, private developer utilities crafted to run in your browser.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
