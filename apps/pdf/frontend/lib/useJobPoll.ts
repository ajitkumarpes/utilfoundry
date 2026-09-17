"use client";

import { useEffect, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";
/**
 * Three seconds keeps a single visitor at 20 requests a minute, the API's per-client limit,
 * including the submit. Polling every 1.8 s used to exhaust that allowance during a long
 * conversion, and the first 429 then ended polling for good while the job finished on the server.
 */
export const POLL_INTERVAL_MS = 3000;
/** Longest wait between checks while the server is refusing or unreachable. */
export const MAX_BACKOFF_MS = 20000;
/** Consecutive transient failures (429, 5xx, network) tolerated before giving up. */
export const MAX_TRANSIENT_FAILURES = 8;

function isTransient(status: number) {
  return status === 429 || status >= 500;
}

function backoffDelay(failures: number, retryAfter: string | null) {
  const hinted = retryAfter ? Number(retryAfter) * 1000 : NaN;
  const exponential = POLL_INTERVAL_MS * 2 ** Math.max(0, failures - 1);
  const delay = Number.isFinite(hinted) && hinted > 0 ? hinted : exponential;
  return Math.min(MAX_BACKOFF_MS, Math.max(POLL_INTERVAL_MS, delay));
}

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

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!jobId) {
      return;
    }
    const id: string = jobId;

    let cancelled = false;
    let failures = 0;

    const clear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const schedule = (delay: number) => {
      clear();
      if (!cancelled) timerRef.current = setTimeout(poll, delay);
    };

    const giveUp = (error: string) => {
      setSnapshot({ jobId: id, status: null, error, resultFilename: null });
      clear();
    };

    async function poll() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/pdf/jobs/${id}`);
        if (cancelled) return;

        if (!response.ok) {
          const error = `Could not check job status (HTTP ${response.status}).`;
          if (isTransient(response.status) && ++failures < MAX_TRANSIENT_FAILURES) {
            // Busy or briefly unavailable: the job is still running server-side, so wait and ask again.
            schedule(backoffDelay(failures, response.headers?.get?.("Retry-After") ?? null));
            return;
          }
          giveUp(error);
          return;
        }

        const data: JobStatusPayload = await response.json();
        if (cancelled) return;
        failures = 0;

        setSnapshot({
          jobId: id,
          status: data.status,
          error: data.status === "FAILED" ? data.errorMessage || "This job failed." : null,
          resultFilename: data.resultFilename
        });

        if (data.status === "SUCCEEDED" || data.status === "FAILED") {
          clear();
          return;
        }
        schedule(POLL_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        if (++failures < MAX_TRANSIENT_FAILURES) {
          schedule(backoffDelay(failures, null));
          return;
        }
        giveUp("Could not reach the server to check job status.");
      }
    }

    poll();

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
