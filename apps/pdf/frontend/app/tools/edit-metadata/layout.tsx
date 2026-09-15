import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit PDF Metadata",
  description: "Change the Title, Author, Subject and Keywords stored inside a PDF's document properties."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
