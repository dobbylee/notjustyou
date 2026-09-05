import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { readJsonBody } from "@/lib/http/read-json-body";
import { POST as report } from "@/app/api/report/route";
import { POST as clicks } from "@/app/api/clicks/route";
import { POST as register } from "@/app/api/collectors/register/route";
import { POST as heartbeat } from "@/app/api/collectors/heartbeat/route";
import { POST as signal } from "@/app/api/signals/route";

vi.mock("@/lib/storage", () => ({
  getReportStorage: vi.fn(() => { throw new Error("Storage must not be reached"); }),
  getSignalStorage: vi.fn(() => { throw new Error("Storage must not be reached"); }),
}));

function streamedRequest(chunks: Uint8Array[], headers?: HeadersInit) {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel,
  }, { highWaterMark: 0 });
  const request = new NextRequest("http://localhost/api/test", {
    method: "POST", body: stream, headers,
    // Node requires duplex for a streamed request body.
    ...{ duplex: "half" },
  });
  return { request, cancel };
}

const encode = (text: string) => new TextEncoder().encode(text);

describe("bounded JSON bodies", () => {
  it("preserves UTF-8 characters split across chunks at the exact byte limit", async () => {
    const bytes = encode('{"value":"가"}');
    const { request } = streamedRequest([bytes.slice(0, 11), bytes.slice(11)]);
    await expect(readJsonBody(request, bytes.length)).resolves.toEqual({
      ok: true, json: { value: "가" },
    });
    expect(request.body?.locked).toBe(false);
  });

  it.each([undefined, { "content-length": "1" }])(
    "cancels an oversized chunked body despite its declared length (%j)", async (headers) => {
      const chunks = [encode('"'), encode("x".repeat(8)), encode("unread")];
      const { request, cancel } = streamedRequest(chunks, headers);
      await expect(readJsonBody(request, 8)).resolves.toEqual({
        ok: false, reason: "body_too_large",
      });
      expect(cancel).toHaveBeenCalledOnce();
      expect(chunks).toHaveLength(1);
      expect(request.body?.locked).toBe(false);
    },
  );

  it("rejects a declared oversized body without reading it", async () => {
    const chunks = [encode("unread")];
    const { request, cancel } = streamedRequest(chunks, { "content-length": "9" });
    await expect(readJsonBody(request, 8)).resolves.toMatchObject({ reason: "body_too_large" });
    expect(chunks).toHaveLength(1);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("handles stream errors without exposing input or throwing a server error", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: new ReadableStream({ start(c) { c.error(new Error("private body")); } }),
      ...{ duplex: "half" },
    });
    await expect(readJsonBody(request, 8)).resolves.toEqual({ ok: false, reason: "invalid_json" });
    expect(request.body?.locked).toBe(false);
  });

  it("preserves the signal empty-body default and rejects other empty or malformed bodies", async () => {
    const empty = () => new Request("http://localhost", { method: "POST" });
    await expect(readJsonBody(empty(), 8, {})).resolves.toEqual({ ok: true, json: {} });
    await expect(readJsonBody(empty(), 8)).resolves.toMatchObject({ reason: "invalid_json" });
    await expect(readJsonBody(new Request("http://localhost", { method: "POST", body: "{" }), 8))
      .resolves.toMatchObject({ reason: "invalid_json" });
  });

  it.each([
    ["report", report, 413], ["clicks", clicks, 413],
    ["register", register, 400], ["heartbeat", heartbeat, 400], ["signal", signal, 400],
  ] as const)("rejects oversized %s input before accessing storage", async (_name, handler, status) => {
    const { request, cancel } = streamedRequest([encode("x".repeat(8193)), encode("unread")]);
    const response = await handler(request);
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ ok: false, reason: "body_too_large" });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
