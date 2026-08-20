import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign PDF",
  description: "Draw or upload a signature and drag it onto the page — a visual signature stamp, not a certified digital signature."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
