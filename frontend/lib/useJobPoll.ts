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
  const [snapshot, setSnapshot] = useState<{
    jobId: string;
    status: JobStatusValue | null;
    error: string | null;
    resultFilename: string | null;
  }>({ jobId: "", status: null, error: null, resultFilename: null });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) {
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
          setSnapshot({
            jobId,
            status: null,
            error: `Could not check job status (HTTP ${response.status}).`,
            resultFilename: null
          });
          clear();
          return;
        }

        const data: JobStatusPayload = await response.json();
        if (cancelled) return;

        setSnapshot({
          jobId,
          status: data.status,
          error: data.status === "FAILED" ? data.errorMessage || "This job failed." : null,
          resultFilename: data.resultFilename
        });

        if (data.status === "SUCCEEDED" || data.status === "FAILED") {
          clear();
        }
      } catch {
        if (!cancelled) {
          setSnapshot({
            jobId,
            status: null,
            error: "Could not reach the server to check job status.",
            resultFilename: null
          });
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

  if (!jobId || snapshot.jobId !== jobId) {
    return { status: null, error: null, resultFilename: null };
  }

  return {
    status: snapshot.status,
    error: snapshot.error,
    resultFilename: snapshot.resultFilename
  };
}
