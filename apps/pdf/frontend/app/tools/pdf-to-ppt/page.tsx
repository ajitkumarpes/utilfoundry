import type { Metadata } from "next";
import JobToolWorkspace from "@/components/JobToolWorkspace";

export const metadata: Metadata = {
  title: "PDF to PowerPoint",
  description: "Convert a PDF into an editable PowerPoint presentation. Free, private, no account needed."
};

export default function PdfToPptPage() {
  return (
    <JobToolWorkspace
      title="PDF to PowerPoint"
      description="Convert a PDF into an editable PowerPoint presentation."
      actionLabel="Convert to PowerPoint"
      endpoint="/api/v1/pdf/pdf-to-ppt"
      resultNote="Complex layouts may not convert perfectly — that's a LibreOffice limitation, not something we can fully engineer around."
    />
  );
}
