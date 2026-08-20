import ToolWorkspace from "@/components/ToolWorkspace";

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
