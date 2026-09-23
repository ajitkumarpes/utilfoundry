/**
 * Request helpers for the route handlers. Route handlers have no body-size limit of their
 * own, so without one a single request could make the server buffer any amount of data.
 */

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Reads a JSON body, refusing anything over `maxBytes` before or while it streams in. */
export async function readJsonBody(request: Request, maxBytes = 8 * 1024): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, "Request body is too large");
  if (!request.body) throw new HttpError(400, "Request body is required");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "Request body is too large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

/** One-line JSON log entry, so a log collector can parse it; never includes request bodies. */
export function logError(route: string, error: unknown) {
  console.error(JSON.stringify({
    level: "error",
    route,
    message: error instanceof Error ? error.message : String(error),
    at: new Date().toISOString()
  }));
}
