import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF to Text",
  description: "Pull the plain, selectable text out of a PDF into a .txt file. Free, private, no account needed."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
