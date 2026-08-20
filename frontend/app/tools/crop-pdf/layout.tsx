import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crop PDF",
  description: "Automatically trims blank margins from every page — no dragging handles required. Free, private, no account needed."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
