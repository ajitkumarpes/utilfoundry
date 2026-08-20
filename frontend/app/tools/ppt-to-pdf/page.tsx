import JobToolWorkspace from "@/components/JobToolWorkspace";
import { PPT_ACCEPT } from "@/components/SinglePdfInput";

export default function PptToPdfPage() {
  return (
    <JobToolWorkspace
      title="PowerPoint to PDF"
      description="Convert a PowerPoint presentation into a PDF."
      actionLabel="Convert to PDF"
      endpoint="/api/v1/pdf/ppt-to-pdf"
      accept={PPT_ACCEPT}
    />
  );
}
