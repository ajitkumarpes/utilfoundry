import type { Metadata } from "next";
import ToolWorkspace from "@/components/ToolWorkspace";

export const metadata: Metadata = {
  title: "Image to PDF",
  description: "Turn JPG or PNG photos into a single PDF — handy for Aadhaar, PAN, passport and other document uploads."
};

export default function ImageToPdfPage() {
  return (
    <ToolWorkspace
      title="Image to PDF"
      description="Turn JPG or PNG photos into a single PDF — handy for Aadhaar, PAN, passport and other document uploads."
      actionLabel="Convert to PDF"
      endpoint="/api/v1/pdf/images-to-pdf"
      resultFilename="converted.pdf"
      resultNoun="image"
      resultVerb="converted to PDF"
      fileKind="image"
      minFiles={1}
    />
  );
}
