"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ChangeEvent } from "react";

type SignatureSource = "draw" | "upload";

type Props = {
  /** Fired with the finished image whenever one becomes available (drawing "Use this signature",
   *  or picking a file), and with (null, null) whenever a previous one stops being current -
   *  cleared, or the source tab switched. */
  onChange: (blob: Blob | null, url: string | null) => void;
  onError?: (message: string) => void;
};

/**
 * The "Draw a signature on a pad, or upload an image instead" widget shared by /tools/sign-pdf
 * and the Sign tool inside /tools/edit-pdf, so the two don't carry two copies of the same canvas
 * drawing logic that could quietly drift apart.
 */
export default function SignaturePad({ onChange, onError }: Props) {
  const [signatureSource, setSignatureSource] = useState<SignatureSource>("draw");
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const padPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const rect = canvas?.getBoundingClientRect();
    if (ctx && rect) {
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }
  };
  const padPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const rect = canvas?.getBoundingClientRect();
    if (ctx && rect) {
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#171717";
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    }
  };
  const padPointerUp = () => {
    drawing.current = false;
  };

  function clearPad() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (signatureUrl) URL.revokeObjectURL(signatureUrl);
    setSignatureUrl(null);
    onChange(null, null);
  }

  function useDrawnSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      if (signatureUrl) URL.revokeObjectURL(signatureUrl);
      const url = URL.createObjectURL(blob);
      setSignatureUrl(url);
      onChange(blob, url);
    }, "image/png");
  }

  function onUploadSignature(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      onError?.("Select a PNG or JPEG image for your signature.");
      return;
    }
    if (signatureUrl) URL.revokeObjectURL(signatureUrl);
    const url = URL.createObjectURL(picked);
    setSignatureUrl(url);
    onChange(picked, url);
  }

  function switchSource(source: SignatureSource) {
    setSignatureSource(source);
    if (signatureUrl) URL.revokeObjectURL(signatureUrl);
    setSignatureUrl(null);
    onChange(null, null);
  }

  return (
    <div>
      <div className="segmented" style={{ marginBottom: 14 }}>
        <button type="button" className={signatureSource === "draw" ? "active" : ""} onClick={() => switchSource("draw")}>
          Draw
        </button>
        <button type="button" className={signatureSource === "upload" ? "active" : ""} onClick={() => switchSource("upload")}>
          Upload image
        </button>
      </div>

      {signatureSource === "draw" && (
        <div>
          <canvas
            ref={canvasRef}
            width={400}
            height={140}
            className="sig-pad"
            onPointerDown={padPointerDown}
            onPointerMove={padPointerMove}
            onPointerUp={padPointerUp}
            onPointerLeave={padPointerUp}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" className="secondary-btn" onClick={clearPad}>
              Clear
            </button>
            <button type="button" className="secondary-btn" onClick={useDrawnSignature}>
              Use this signature
            </button>
          </div>
        </div>
      )}

      {signatureSource === "upload" && (
        <label className="secondary-btn" style={{ display: "inline-flex", cursor: "pointer" }}>
          Choose signature image
          <input type="file" accept="image/png,image/jpeg" onChange={onUploadSignature} style={{ display: "none" }} />
        </label>
      )}
    </div>
  );
}
