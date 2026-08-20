import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF to Image",
  description: "Convert each page of a PDF into a JPG or PNG image. Free, private, no account needed."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
