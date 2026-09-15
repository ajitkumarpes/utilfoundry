import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sanitize PDF",
  description: "Strip hidden metadata, attachments, comments, clickable links, or embedded scripts before sharing a file."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
