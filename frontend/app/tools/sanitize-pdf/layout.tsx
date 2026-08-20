import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sanitize PDF",
  description: "Strip hidden metadata, attachments, comments, or embedded scripts before sharing a file."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
