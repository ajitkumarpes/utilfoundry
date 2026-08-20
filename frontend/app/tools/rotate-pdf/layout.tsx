import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rotate PDF",
  description: "Rotate every page in a PDF at once — for scans that came out sideways or upside down."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
