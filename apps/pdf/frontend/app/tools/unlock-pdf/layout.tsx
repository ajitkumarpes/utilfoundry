import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unlock PDF",
  description: "Remove a password from a PDF you already know the password to."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
