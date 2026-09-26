"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";

type Props = {
  open: boolean;
  onConfirm: (blob: Blob, url: string) => void;
  onClose: () => void;
};

/**
 * The Sign tool's dialog inside the editor - same draw-or-upload choice as the standalone
 * /tools/sign-pdf page (via the shared SignaturePad), just placed on the canvas immediately
 * instead of a separate drag-to-place step, matching how Image already works here. Built on the
 * native <dialog> element, the same base FeedbackWidget uses elsewhere in this app, rather than a
 * hand-rolled backdrop + portal.
 */
export default function EditPdfSignDialog({ open, onConfirm, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleChange(blob: Blob | null, url: string | null) {
    if (blob && url) onConfirm(blob, url);
  }

  return (
    <dialog ref={dialogRef} className="feedback-dialog" onClose={onClose}>
      <div className="edit-sign-dialog-body">
        <div className="feedback-dialog-head">
          <div>
            <h2>Create your signature</h2>
            <p>Draw it, or upload an image - it&rsquo;s placed on the page right away so you can drag it into position.</p>
          </div>
          <button type="button" className="feedback-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && (
          <p className="feedback-error" role="alert">
            {error}
          </p>
        )}

        <SignaturePad onChange={handleChange} onError={setError} />
      </div>
    </dialog>
  );
}
