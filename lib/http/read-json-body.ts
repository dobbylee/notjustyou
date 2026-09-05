export type JsonBodyResult =
  | { ok: true; json: unknown }
  | { ok: false; reason: "body_too_large" | "invalid_json" };

// Enforce the byte limit while reading, including chunked bodies and incorrect
// Content-Length values. Never include untrusted body text in errors.
export async function readJsonBody(
  request: Request,
  maxBytes: number,
  emptyValue?: unknown,
): Promise<JsonBodyResult> {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      void reader?.cancel().catch(() => undefined);
      return { ok: false, reason: "body_too_large" };
    }

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          void reader.cancel().catch(() => undefined);
          return { ok: false, reason: "body_too_large" };
        }
        chunks.push(value);
      }
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder().decode(bytes);
    if (!text) {
      return emptyValue === undefined
        ? { ok: false, reason: "invalid_json" }
        : { ok: true, json: emptyValue };
    }
    return { ok: true, json: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: "invalid_json" };
  } finally {
    reader?.releaseLock();
  }
}
