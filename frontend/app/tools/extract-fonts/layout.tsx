import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Extract Fonts",
  description: "Pull the embedded font files out of a PDF. Only extract fonts you have the right to use outside the document."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
