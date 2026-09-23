"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Info } from "lucide-react";

export type ToastTone = "success" | "info";
type ToastMessage = { id: number; text: string; tone: ToastTone };

/** One short-lived confirmation at a time, e.g. "Copied to clipboard". */
export function useToast() {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((text: string, tone: ToastTone = "success") => {
    window.clearTimeout(timer.current);
    setMessage({ id: Date.now(), text, tone });
    timer.current = window.setTimeout(() => setMessage(null), 2600);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { message, show };
}

export function Toast({ message }: { message: ToastMessage | null }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message && (
        <div key={message.id} className={`toast is-${message.tone}`}>
          {message.tone === "success" ? <CheckCircle2 size={16} aria-hidden /> : <Info size={16} aria-hidden />}
          {message.text}
        </div>
      )}
    </div>
  );
}
