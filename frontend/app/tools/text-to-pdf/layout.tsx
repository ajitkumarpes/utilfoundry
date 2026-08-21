import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Text to PDF",
  description: "Paste plain text or upload a .txt file and turn it into a PDF. Long lines wrap and pages break automatically."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
