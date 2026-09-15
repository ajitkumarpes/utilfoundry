import type { Metadata } from "next";
import JobToolWorkspace from "@/components/JobToolWorkspace";
import { WORD_ACCEPT } from "@/components/SinglePdfInput";

export const metadata: Metadata = {
  title: "Word to PDF",
  description: "Convert a Word document into a PDF. Free, private, no account needed."
};

export default function WordToPdfPage() {
  return (
    <JobToolWorkspace
      title="Word to PDF"
      description="Convert a Word document into a PDF."
      actionLabel="Convert to PDF"
      endpoint="/api/v1/pdf/word-to-pdf"
      accept={WORD_ACCEPT}
    />
  );
}
