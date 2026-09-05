import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStatusData as cliStatus, registerCollector } from "@/packages/notjustyou-cli/src/api";
import { fetchStatusData as mcpStatus } from "@/packages/notjustyou-mcp/src/api";

afterEach(() => { vi.useRealTimers(); });

function untilAbort(signal: AbortSignal) {
  return new Promise<never>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("request timed out")), { once: true });
  });
}

describe.each([["CLI", cliStatus], ["MCP", mcpStatus]] as const)("%s request deadlines", (_name, fetchStatus) => {
  it.each(["headers", "body"])("returns successful sources when the official %s stalls", async (stage) => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/api/official")) {
        if (stage === "headers") return untilAbort(init.signal!);
        return { ok: true, json: () => untilAbort(init.signal!) };
      }
      return Response.json({ services: [] });
    }));
    const pending = fetchStatus("http://localhost");
    const assertion = expect(pending).resolves.toMatchObject({
      community: { services: [] }, installedSignals: { services: [] }, official: null,
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects when every source times out and clears timers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => untilAbort(init.signal!)));
    const assertion = expect(fetchStatus("http://localhost")).rejects.toThrow("request timed out");
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});

it("does not retry collector registration when its response times out", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn((_url: string, init: RequestInit) => untilAbort(init.signal!));
  vi.stubGlobal("fetch", fetchMock);
  const assertion = expect(registerCollector({
    baseUrl: "http://localhost", source: "cli_hook", serviceIds: ["anthropic-claude-code"],
    clientName: "test-client", clientVersion: "0.0.0",
  })).rejects.toThrow("request timed out");
  await vi.advanceTimersByTimeAsync(10_000);
  await assertion;
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
