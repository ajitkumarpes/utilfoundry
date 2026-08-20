import type { Metadata } from "next";
import ToolWorkspace from "@/components/ToolWorkspace";

export const metadata: Metadata = {
  title: "Merge PDF",
  description: "Combine multiple PDF files into one document, in the order you choose. Free, private, no account needed."
};

export default function MergePdfPage() {
  return (
    <ToolWorkspace
      title="Merge PDF"
      description="Combine multiple PDF files into one document, in the order you choose."
      actionLabel="Merge PDFs"
      endpoint="/api/v1/pdf/merge"
      resultFilename="merged.pdf"
      resultNoun="PDF"
      resultVerb="merged"
      fileKind="pdf"
      minFiles={2}
    />
  );
}
