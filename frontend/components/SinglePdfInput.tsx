"use client";

import { useCallback } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { FileText, Plus, ShieldCheck, Trash2, UploadCloud } from "lucide-react";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

type Props = {
  file: File | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
  fileMeta?: string;
};

export default function SinglePdfInput({ file, onSelect, onClear, onError, disabled, fileMeta }: Props) {
  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length && !accepted.length) {
        onError("Only a single PDF file is allowed.");
        return;
      }
      const picked = accepted[0];
      if (!picked) return;
      if (picked.type !== "application/pdf" && !picked.name.toLowerCase().endsWith(".pdf")) {
        onError("Only PDF files are allowed.");
        return;
      }
      if (picked.size > MAX_FILE_SIZE) {
        onError("The PDF must be 50 MB or smaller.");
        return;
      }
      onSelect(picked);
    },
    [onSelect, onError]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    noClick: true,
    multiple: false,
    disabled
  });

  if (file) {
    return (
      <div className="file-panel">
        <div className="file-list" style={{ marginBottom: 0 }}>
          <div className="file-row">
            <div className="file-icon">
              <FileText size={20} />
            </div>
            <div className="file-info">
              <strong>{file.name}</strong>
              <span>
                {(file.size / 1048576).toFixed(2)} MB{fileMeta ? ` · ${fileMeta}` : ""}
              </span>
            </div>
            <button type="button" className="icon-btn" onClick={onClear} disabled={disabled} aria-label="Replace file">
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div {...getRootProps()} className={`upload-zone ${isDragActive ? "dragging" : ""}`}>
      <input {...getInputProps()} />
      <div className="upload-icon">
        <UploadCloud size={30} />
      </div>
      <h2>{isDragActive ? "Drop your PDF here" : "Drop a PDF file here"}</h2>
      <p>or choose a file from your device</p>
      <button type="button" onClick={open} className="primary-btn">
        <Plus size={18} /> Select PDF file
      </button>
      <div className="trust-row">
        <span>
          <ShieldCheck size={15} /> Files are private
        </span>
        <span>Up to 50 MB</span>
      </div>
    </div>
  );
}
