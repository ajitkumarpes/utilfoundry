import type { Metadata } from "next";
import JobToolWorkspace from "@/components/JobToolWorkspace";
import { EXCEL_ACCEPT } from "@/components/SinglePdfInput";

export const metadata: Metadata = {
  title: "Excel to PDF",
  description: "Convert an Excel spreadsheet into a PDF. Free, private, no account needed."
};

export default function ExcelToPdfPage() {
  return (
    <JobToolWorkspace
      title="Excel to PDF"
      description="Convert an Excel spreadsheet into a PDF."
      actionLabel="Convert to PDF"
      endpoint="/api/v1/pdf/excel-to-pdf"
      accept={EXCEL_ACCEPT}
    />
  );
}
