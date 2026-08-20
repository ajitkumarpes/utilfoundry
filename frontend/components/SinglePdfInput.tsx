"use client";

import { useCallback } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { FileText, Plus, ShieldCheck, Trash2, UploadCloud } from "lucide-react";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export type FileAccept = {
  mimeTypes: Record<string, string[]>;
  label: string;
  test: (file: File) => boolean;
};

export const PDF_ACCEPT: FileAccept = {
  mimeTypes: { "application/pdf": [".pdf"] },
  label: "PDF",
  test: f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
};

export const PDF_OR_IMAGE_ACCEPT: FileAccept = {
  mimeTypes: {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"]
  },
  label: "PDF or image",
  test: f =>
    f.type === "application/pdf" ||
    f.type.startsWith("image/") ||
    /\.(pdf|jpe?g|png)$/i.test(f.name)
};

export const WORD_ACCEPT: FileAccept = {
  mimeTypes: {
    "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"]
  },
  label: "Word",
  test: f => /\.docx?$/i.test(f.name)
};

export const EXCEL_ACCEPT: FileAccept = {
  mimeTypes: {
    "application/vnd.ms-excel": [".xls"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"]
  },
  label: "Excel",
  test: f => /\.xlsx?$/i.test(f.name)
};

export const PPT_ACCEPT: FileAccept = {
  mimeTypes: {
    "application/vnd.ms-powerpoint": [".ppt"],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"]
  },
  label: "PowerPoint",
  test: f => /\.pptx?$/i.test(f.name)
};

type Props = {
  file: File | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
  fileMeta?: string;
  accept?: FileAccept;
};

export default function SinglePdfInput({
  file,
  onSelect,
  onClear,
  onError,
  disabled,
  fileMeta,
  accept = PDF_ACCEPT
}: Props) {
  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length && !accepted.length) {
        onError(`Only a single ${accept.label} file is allowed.`);
        return;
      }
      const picked = accepted[0];
      if (!picked) return;
      if (!accept.test(picked)) {
        onError(`Only ${accept.label} files are allowed.`);
        return;
      }
      if (picked.size > MAX_FILE_SIZE) {
        onError(`The file must be 50 MB or smaller.`);
        return;
      }
      onSelect(picked);
    },
    [onSelect, onError, accept]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: accept.mimeTypes,
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
      <h2>{isDragActive ? `Drop your ${accept.label} file here` : `Drop a ${accept.label} file here`}</h2>
      <p>or choose a file from your device</p>
      <button type="button" onClick={open} className="primary-btn">
        <Plus size={18} /> Select {accept.label} file
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
