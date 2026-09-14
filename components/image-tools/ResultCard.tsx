"use client";
/* eslint-disable @next/next/no-img-element */

import { Copy, Download, FileOutput } from "lucide-react";
import type { ToolId } from "@/lib/tools";
import type { ProcessResult } from "@/components/image-tools/types";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type ResultCardProps = {
  result: ProcessResult;
  activeTool: ToolId;
  onCopy: (value: string) => void;
};

export function ResultCard({ result, activeTool, onCopy }: ResultCardProps) {
  const isImageResult = result.mime?.startsWith("image/");
  return (
    <section className="result-card">
      <div className="card-heading"><div><span className="section-kicker">OUTPUT</span><h2>Ready to use</h2></div><span className="result-size">{result.size ? formatBytes(result.size) : ""}</span></div>
      {result.text !== undefined ? <div className="text-result">{result.confidence !== undefined && result.confidence !== null && <div className="confidence">Average OCR confidence: {result.confidence}%</div>}<textarea readOnly value={result.text} /><div className="result-actions"><button onClick={() => onCopy(result.text ?? "")}><Copy size={15} /> Copy</button><a className="download-button" href={`data:text/plain;charset=utf-8,${encodeURIComponent(result.text ?? "")}`} download={`${activeTool}.txt`}><Download size={15} /> Download TXT</a></div></div> : <div className="result-content">{isImageResult && result.url ? <img src={result.url} alt="Processed image preview" /> : <div className="pdf-result"><FileOutput size={32} /><span><strong>PDF generated</strong><small>{result.name}</small></span></div>}<a className="download-button" href={result.url} download={result.name}><Download size={16} /> Download output</a></div>}
    </section>
  );
}
