import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OCR PDF",
  description: "Turn a scanned PDF or photo into a searchable PDF with real, selectable text. English and Hindi supported."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
