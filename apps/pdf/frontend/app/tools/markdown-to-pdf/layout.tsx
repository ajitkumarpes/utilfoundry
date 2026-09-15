import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Markdown to PDF",
  description: "Paste Markdown or upload a .md file and turn it into a PDF. Headings, lists, code blocks, quotes and links all render."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
