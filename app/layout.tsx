import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UtilNexa Developer Tools",
  description: "Fast, private developer utilities that run in your browser.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
