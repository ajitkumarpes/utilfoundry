"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy-to-clipboard with the short "Copied" acknowledgement every tool shows.
 * `copied` holds the label of whatever was last copied, so a panel with several
 * copy buttons can confirm the right one.
 */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");
  const timer = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(async (value: string, label = "value") => {
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      setError("");
      setCopied(label);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), 1600);
      return true;
    } catch {
      setError("Copying is blocked in this browser. Select the text and copy it manually.");
      return false;
    }
  }, []);

  return { copy, copied, copyError: error };
}
