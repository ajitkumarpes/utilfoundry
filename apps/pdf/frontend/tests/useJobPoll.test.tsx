import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TRANSIENT_FAILURES, POLL_INTERVAL_MS, useJobPoll } from "../lib/useJobPoll";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

function job(status: string, extra: Record<string, unknown> = {}) {
  return {
    jobId: "job-1",
    type: "compress",
    status,
    errorMessage: null,
    resultFilename: null,
    createdAt: "2026-09-16T00:00:00Z",
    ...extra,
  };
}

/** Lets the hook's immediate poll resolve before assertions. */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function tick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useJobPoll", () => {
  it("does nothing without a job id", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useJobPoll(null));
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ status: null, error: null, resultFilename: null });
  });

  it("polls until the job succeeds, then stops", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(job("QUEUED")))
      .mockResolvedValueOnce(jsonResponse(job("PROCESSING")))
      .mockResolvedValueOnce(jsonResponse(job("SUCCEEDED", { resultFilename: "out.pdf" })));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useJobPoll("job-1"));

    await flush();
    expect(result.current.status).toBe("QUEUED");

    await tick();
    expect(result.current.status).toBe("PROCESSING");

    await tick();
    expect(result.current.status).toBe("SUCCEEDED");
    expect(result.current.resultFilename).toBe("out.pdf");

    // Polling has stopped: further time passes without another request.
    const callsAtSuccess = fetchMock.mock.calls.length;
    await tick();
    await tick();
    expect(fetchMock.mock.calls.length).toBe(callsAtSuccess);
  });

  it("surfaces the server's failure message and stops polling", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(job("FAILED", { errorMessage: "The document is encrypted." })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useJobPoll("job-1"));
    await flush();

    expect(result.current.status).toBe("FAILED");
    expect(result.current.error).toBe("The document is encrypted.");

    const calls = fetchMock.mock.calls.length;
    await tick();
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("falls back to a generic message when a failure carries none", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(job("FAILED"))));

    const { result } = renderHook(() => useJobPoll("job-1"));
    await flush();

    expect(result.current.error).toBe("This job failed.");
  });

  it("stays at or under 20 requests a minute, the API's per-client limit", () => {
    expect(60_000 / POLL_INTERVAL_MS).toBeLessThanOrEqual(20);
  });

  it("stops at once on a response that will not change, such as an unknown job", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 404));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useJobPoll("job-1"));
    await flush();

    expect(result.current.error).toBe("Could not check job status (HTTP 404).");
    expect(result.current.status).toBeNull();

    const calls = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("keeps polling through a rate limit and still delivers the result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(job("PROCESSING")))
      .mockResolvedValueOnce(jsonResponse(null, false, 429))
      .mockResolvedValueOnce(jsonResponse(null, false, 429))
      .mockResolvedValueOnce(jsonResponse(job("SUCCEEDED", { resultFilename: "out.docx" })));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useJobPoll("job-1"));
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe("SUCCEEDED");
    expect(result.current.resultFilename).toBe("out.docx");
  });

  it("backs off between retries instead of hammering a busy server", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 503));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useJobPoll("job-1"));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The second retry waits twice as long.
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up with the status code only after repeated server errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 503));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useJobPoll("job-1"));
    await flush();
    expect(result.current.error).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(MAX_TRANSIENT_FAILURES);
    expect(result.current.error).toBe("Could not check job status (HTTP 503).");
  });

  it("recovers from a brief network drop", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce(jsonResponse(job("SUCCEEDED", { resultFilename: "a.pdf" })));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useJobPoll("job-1"));
    await flush();
    await tick();

    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe("SUCCEEDED");
  });

  it("reports a lasting network failure in plain words", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

    const { result } = renderHook(() => useJobPoll("job-1"));
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });

    expect(result.current.error).toBe("Could not reach the server to check job status.");
  });

  it("stops polling once unmounted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(job("PROCESSING")));
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = renderHook(() => useJobPoll("job-1"));
    await flush();
    const callsBefore = fetchMock.mock.calls.length;

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });

    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it("reports nothing for a new job until that job answers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(job("SUCCEEDED", { resultFilename: "a.pdf" })));
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useJobPoll(id), {
      initialProps: { id: "job-1" as string | null },
    });
    await flush();
    expect(result.current.resultFilename).toBe("a.pdf");

    // The snapshot still holds job-1, so the stale result must not leak into job-2.
    fetchMock.mockImplementation(() => new Promise(() => {}));
    rerender({ id: "job-2" });
    expect(result.current).toEqual({ status: null, error: null, resultFilename: null });
  });

  it("requests the job endpoint for the id it was given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(job("QUEUED")));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useJobPoll("abc-123"));
    await flush();

    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/pdf/jobs/abc-123");
  });

  /*
   * A poll in flight when the component goes away: the hook checks a cancelled flag after
   * each await so it neither updates state on a dead component nor keeps the interval
   * alive. Each case holds the promise open, unmounts, then lets it settle.
   */
  describe("when the component unmounts mid-poll", () => {
    it("ignores a response that arrives afterwards", async () => {
      let settle: (value: Response) => void = () => {};
      const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { settle = resolve; }));
      vi.stubGlobal("fetch", fetchMock);

      const { unmount } = renderHook(() => useJobPoll("job-1"));
      await flush();
      unmount();

      await act(async () => {
        settle(jsonResponse(job("SUCCEEDED", { resultFilename: "late.pdf" })));
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("ignores a body that parses afterwards", async () => {
      let settle: (value: unknown) => void = () => {};
      const response = {
        ok: true,
        status: 200,
        json: () => new Promise((resolve) => { settle = resolve; }),
      } as unknown as Response;
      const fetchMock = vi.fn().mockResolvedValue(response);
      vi.stubGlobal("fetch", fetchMock);

      const { unmount } = renderHook(() => useJobPoll("job-1"));
      await flush();
      unmount();

      await act(async () => {
        settle(job("SUCCEEDED", { resultFilename: "late.pdf" }));
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("swallows a network failure that lands afterwards", async () => {
      let fail: (reason?: unknown) => void = () => {};
      const fetchMock = vi.fn(() => new Promise<Response>((_resolve, reject) => { fail = reject; }));
      vi.stubGlobal("fetch", fetchMock);

      const { unmount } = renderHook(() => useJobPoll("job-1"));
      await flush();
      unmount();

      await act(async () => {
        fail(new Error("connection reset"));
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
