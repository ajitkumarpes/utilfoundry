import "./globals.css";

export const metadata = {
  title: "PDF Utility Platform",
  description: "Simple, private PDF tools."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
