"use client";

import { useEffect, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";
const POLL_INTERVAL_MS = 1800;

export type JobStatusValue = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";

type JobStatusPayload = {
  jobId: string;
  type: string;
  status: JobStatusValue;
  errorMessage: string | null;
  resultFilename: string | null;
  createdAt: string;
};

export function useJobPoll(jobId: string | null) {
  const [status, setStatus] = useState<JobStatusValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) {
      setStatus(null);
      setError(null);
      setResultFilename(null);
      return;
    }

    let cancelled = false;

    const clear = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/pdf/jobs/${jobId}`);
        if (cancelled) return;

        if (!response.ok) {
          setError(`Could not check job status (HTTP ${response.status}).`);
          clear();
          return;
        }

        const data: JobStatusPayload = await response.json();
        if (cancelled) return;

        setStatus(data.status);
        setResultFilename(data.resultFilename);

        if (data.status === "SUCCEEDED" || data.status === "FAILED") {
          if (data.status === "FAILED") setError(data.errorMessage || "This job failed.");
          clear();
        }
      } catch {
        if (!cancelled) {
          setError("Could not reach the server to check job status.");
          clear();
        }
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clear();
    };
  }, [jobId]);

  return { status, error, resultFilename };
}
