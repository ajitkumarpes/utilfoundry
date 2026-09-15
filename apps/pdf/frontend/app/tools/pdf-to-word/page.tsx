import type { Metadata } from "next";
import JobToolWorkspace from "@/components/JobToolWorkspace";

export const metadata: Metadata = {
  title: "PDF to Word",
  description: "Convert a PDF into an editable Word document. Free, private, no account needed."
};

export default function PdfToWordPage() {
  return (
    <JobToolWorkspace
      title="PDF to Word"
      description="Convert a PDF into an editable Word document."
      actionLabel="Convert to Word"
      endpoint="/api/v1/pdf/pdf-to-word"
      resultNote="Complex layouts may not convert perfectly — that's a LibreOffice limitation, not something we can fully engineer around."
    />
  );
}
