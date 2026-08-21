import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Extract Attachments",
  description: "Pull every file embedded inside a PDF back out — document-level attachments and page-pinned files alike."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
