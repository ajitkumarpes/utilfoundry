import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HTML to PDF",
  description: "Paste HTML with inline or embedded CSS, or upload a .html file, and turn it into a PDF."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
