import { afterEach, describe, expect, it, vi } from "vitest";
import { request as httpRequest } from "node:http";
import {
  assertLocalReceiverHost,
  createLocalHookReceiver,
  getHookSendReadiness,
  LOCAL_HOOK_RECEIVER_HEALTH,
} from "@/packages/notjustyou-cli/src/receiver";
import type { CliConfig } from "@/packages/notjustyou-cli/src/types";

const receivers: Array<ReturnType<typeof createLocalHookReceiver>> = [];

afterEach(async () => {
  const pending = receivers.splice(0);
  await Promise.all(pending.filter((receiver) => receiver.server.listening).map((receiver) => receiver.close()));
  vi.restoreAllMocks();
});

describe("local hook receiver", () => {
  it("binds only to localhost hosts", () => {
    expect(() => assertLocalReceiverHost("127.0.0.1")).not.toThrow();
    expect(() => assertLocalReceiverHost("localhost")).not.toThrow();
    expect(() => assertLocalReceiverHost("0.0.0.0")).toThrow(
      "Local hook receiver only binds to localhost.",
    );
  });

  it("exposes an explicit receiver health check", async () => {
    const receiver = createLocalHookReceiver({
      port: 0,
      readConfig: () => baseConfig,
    });
    receivers.push(receiver);
    const address = await receiver.start();

    const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
      headers: receiverHeaders(),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ...LOCAL_HOOK_RECEIVER_HEALTH,
      mode: "preview",
    });
  });

  it("rejects unauthenticated, cross-origin, and non-json hook requests", async () => {
    const submit = vi.fn();
    const receiver = createLocalHookReceiver({
      port: 0,
      readConfig: () => baseConfig,
      submit,
    });
    receivers.push(receiver);
    const { port } = await receiver.start();
    const url = `http://127.0.0.1:${port}/hook`;

    expect((await fetch(url, { method: "POST", headers: receiverHeaders(), body: "{}" })).status).toBe(415);
    expect((await fetch(url, {
      method: "POST",
      headers: { ...receiverHeaders(), "content-type": "application/json", origin: "https://evil.example" },
      body: "{}",
    })).status).toBe(403);
    expect((await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })).status).toBe(401);
    expect(await postHookWithHost(port, "evil.example")).toBe(403);
    expect(submit).not.toHaveBeenCalled();
  });

  it("accepts metadata-only hook events without sending by default", async () => {
    const submit = vi.fn();
    const receiver = createLocalHookReceiver({
      port: 0,
      submit,
      readConfig: () => baseConfig,
    });
    receivers.push(receiver);
    const address = await receiver.start();

    const response = await postHook(address.port, {
      serviceId: "openai-codex-cli",
      surface: "codex-cli",
      eventName: "run.failed",
      symptom: "tool_failure",
      statusCode: 500,
      errorCode: "tool_failed",
      clientVersion: "0.3.0",
    });

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      mode: "preview",
      payload: {
        serviceId: "openai-codex-cli",
        source: "cli_hook",
        symptom: "tool_failure",
        statusCode: 500,
        errorCode: "tool_failed",
        clientVersion: "0.3.0",
      },
    });
    expect(response.status).toBe(202);
    expect(submit).not.toHaveBeenCalled();
  });

  it("rejects unknown and sensitive hook fields", async () => {
    const receiver = createLocalHookReceiver({
      port: 0,
      readConfig: () => baseConfig,
    });
    receivers.push(receiver);
    const address = await receiver.start();

    const unknownResponse = await postHook(address.port, {
      serviceId: "openai-codex-cli",
      surface: "codex-cli",
      eventName: "run.failed",
      symptom: "tool_failure",
      collectorId: "col_test",
    });
    await expect(unknownResponse.json()).resolves.toEqual({
      ok: false,
      error: "Unknown field rejected: collectorId",
    });

    const sensitiveResponse = await postHook(address.port, {
      serviceId: "openai-codex-cli",
      surface: "codex-cli",
      eventName: "run.failed",
      symptom: "tool_failure",
      prompt: "do not collect",
    });
    await expect(sensitiveResponse.json()).resolves.toEqual({
      ok: false,
      error: "Sensitive field rejected: prompt",
    });
  });

  it("accepts raw Cursor hook payloads locally but returns only normalized metadata", async () => {
    const submit = vi.fn();
    const receiver = createLocalHookReceiver({
      port: 0,
      submit,
      readConfig: () => baseConfig,
    });
    receivers.push(receiver);
    const address = await receiver.start();

    const response = await postHook(address.port, {
      rawHook: "cursor",
      payload: {
        hook_event_name: "sessionEnd",
        reason: "error",
        duration_ms: 1234,
        cursor_version: "1.7.2",
        user_email: "alice@example.com",
        workspace_roots: ["/Users/alice/private-project"],
        transcript_path: "/Users/alice/.cursor/transcript.json",
        error_message: "raw provider or local error text",
      },
    });

    const body = await response.json();
    expect(response.status).toBe(202);
    expect(body).toEqual({
      ok: true,
      mode: "preview",
      payload: {
        serviceId: "cursor-ide",
        source: "cli_hook",
        symptom: "error",
        errorCode: "cursor_session_error",
        durationMs: 1234,
        clientVersion: "1.7.2",
      },
    });
    expect(JSON.stringify(body)).not.toContain("alice@example.com");
    expect(JSON.stringify(body)).not.toContain("/Users/alice");
    expect(JSON.stringify(body)).not.toContain("raw provider");
    expect(submit).not.toHaveBeenCalled();
  });

  it("accepts raw Antigravity hook payloads locally but returns only normalized metadata", async () => {
    const submit = vi.fn();
    const receiver = createLocalHookReceiver({
      port: 0,
      submit,
      readConfig: () => baseConfig,
    });
    receivers.push(receiver);
    const address = await receiver.start();

    const response = await postHook(address.port, {
      rawHook: "antigravity",
      payload: {
        hook_event_name: "Stop",
        service_id: "google-antigravity-cli",
        termination_reason: "error",
        has_error: true,
        fully_idle: true,
        client_version: "2.0.1",
        conversationId: "ec33ebf9-0cba-4100-8142-c61503f6c587",
        workspacePaths: ["/Users/alice/private-project"],
        transcriptPath: "/Users/alice/.gemini/antigravity-cli/transcript.jsonl",
        artifactDirectoryPath: "/Users/alice/.gemini/antigravity-cli/artifacts",
        error: "raw provider or local error text for alice@example.com",
      },
    });

    const body = await response.json();
    expect(response.status).toBe(202);
    expect(body).toEqual({
      ok: true,
      mode: "preview",
      payload: {
        serviceId: "google-antigravity-cli",
        source: "cli_hook",
        symptom: "error",
        errorCode: "antigravity_agent_error",
        clientVersion: "2.0.1",
      },
    });
    expect(JSON.stringify(body)).not.toContain("alice@example.com");
    expect(JSON.stringify(body)).not.toContain("/Users/alice");
    expect(JSON.stringify(body)).not.toContain("raw provider");
    expect(submit).not.toHaveBeenCalled();
  });

  it("rejects malformed raw Antigravity hook envelopes before send readiness", async () => {
    const submit = vi.fn();
    const receiver = createLocalHookReceiver({
      port: 0,
      sendSignals: true,
      readConfig: () => ({
        ...baseConfig,
        serviceIds: ["google-antigravity-cli"],
        localHookSignalOptIn: true,
      }),
      submit,
    });
    receivers.push(receiver);
    const address = await receiver.start();

    const nonIdleResponse = await postHook(address.port, {
      rawHook: "antigravity",
      payload: {
        hook_event_name: "Stop",
        service_id: "google-antigravity-cli",
        termination_reason: "error",
        has_error: true,
        fully_idle: "true",
        workspacePaths: ["/Users/alice/private-project"],
      },
    });
    await expect(nonIdleResponse.json()).resolves.toEqual({
      ok: false,
      error: "Antigravity stop hook is not fully idle.",
    });

    const reasonResponse = await postHook(address.port, {
      rawHook: "antigravity",
      payload: {
        hook_event_name: "Stop",
        service_id: "google-antigravity-cli",
        termination_reason: "raw reason for alice@example.com",
        has_error: true,
        fully_idle: true,
      },
    });
    await expect(reasonResponse.json()).resolves.toEqual({
      ok: false,
      error: "Antigravity stop hook termination reason is unsupported.",
    });

    expect(submit).not.toHaveBeenCalled();
  });

  it("does not send when local hook opt-in is missing", async () => {
    const submit = vi.fn();
    const receiver = createLocalHookReceiver({
      port: 0,
      sendSignals: true,
      readConfig: () => ({
        ...baseConfig,
        localHookSignalOptIn: false,
      }),
      submit,
    });
    receivers.push(receiver);
    const address = await receiver.start();

    const response = await postHook(address.port, validHook());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Local hook signal sending is disabled. Set localHookSignalOptIn to true.",
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it("does not send when the collector token is missing", () => {
    expect(
      getHookSendReadiness(
        {
          ...baseConfig,
          collectorToken: "",
          localHookSignalOptIn: true,
        },
        {
          serviceId: "anthropic-claude-code",
          source: "cli_hook",
          symptom: "error",
        },
      ),
    ).toEqual({
      ok: false,
      reason: "Collector token is missing. Run njy register --source cli_hook first.",
    });
  });

  it("does not send when the config source is not cli_hook", () => {
    expect(
      getHookSendReadiness(
        {
          ...baseConfig,
          source: "api_middleware",
          localHookSignalOptIn: true,
        },
        {
          serviceId: "anthropic-claude-code",
          source: "cli_hook",
          symptom: "error",
        },
      ),
    ).toEqual({
      ok: false,
      reason: "Collector config source must be cli_hook for local hook signals.",
    });
  });

  it("does not send when the service is outside the collector allowlist", () => {
    expect(
      getHookSendReadiness(
        {
          ...baseConfig,
          serviceIds: ["openai-codex-cli"],
          localHookSignalOptIn: true,
        },
        {
          serviceId: "anthropic-claude-code",
          source: "cli_hook",
          symptom: "error",
        },
      ),
    ).toEqual({
      ok: false,
      reason: "Collector config does not allow this serviceId.",
    });
  });

  it("can send non-Claude local hook signals when config explicitly allows the service", () => {
    expect(
      getHookSendReadiness(
        {
          ...baseConfig,
          serviceIds: ["cursor-ide"],
          localHookSignalOptIn: true,
        },
        {
          serviceId: "cursor-ide",
          source: "cli_hook",
          symptom: "error",
        },
      ),
    ).toEqual({ ok: true });
  });

  it("does not send Codex hook metadata even if a config was hand-edited to opt in", () => {
    expect(
      getHookSendReadiness(
        {
          ...baseConfig,
          serviceIds: ["openai-codex-cli"],
          localHookSignalOptIn: true,
        },
        {
          serviceId: "openai-codex-cli",
          source: "cli_hook",
          symptom: "tool_failure",
        },
      ),
    ).toEqual({
      ok: false,
      reason: "Local hook signal sending is not supported for this serviceId.",
    });
  });

  it("sends only normalized metadata after opt-in and collector readiness pass", async () => {
    const submit = vi.fn(async () => undefined);
    const receiver = createLocalHookReceiver({
      port: 0,
      sendSignals: true,
      readConfig: () => ({
        ...baseConfig,
        localHookSignalOptIn: true,
      }),
      submit,
    });
    receivers.push(receiver);
    const address = await receiver.start();

    const response = await postHook(address.port, {
      ...validHook(),
      eventName: "run.failed",
    });

    expect(response.status).toBe(202);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        collectorToken: "njy_secret",
      }),
      {
        serviceId: "anthropic-claude-code",
        source: "cli_hook",
        symptom: "rate_limited",
        statusCode: 500,
        errorCode: "claude_rate_limit",
      },
    );
    expect(JSON.stringify(submit.mock.calls[0])).not.toContain("run.failed");
    expect(JSON.stringify(submit.mock.calls[0])).not.toContain("surface");
  });

  it("sends normalized Cursor metadata without raw payload after opt-in", async () => {
    const submit = vi.fn(async () => undefined);
    const receiver = createLocalHookReceiver({
      port: 0,
      sendSignals: true,
      readConfig: () => ({
        ...baseConfig,
        serviceIds: ["cursor-ide"],
        localHookSignalOptIn: true,
      }),
      submit,
    });
    receivers.push(receiver);
    const address = await receiver.start();

    const response = await postHook(address.port, {
      rawHook: "cursor",
      payload: {
        hook_event_name: "stop",
        status: "error",
        cursor_version: "1.7.2",
        user_email: "alice@example.com",
        workspace_roots: ["/Users/alice/private-project"],
        transcript_path: "/Users/alice/.cursor/transcript.json",
        prompt: "do not collect this prompt",
        output: "do not collect this output",
      },
    });

    expect(response.status).toBe(202);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceIds: ["cursor-ide"],
      }),
      {
        serviceId: "cursor-ide",
        source: "cli_hook",
        symptom: "error",
        errorCode: "cursor_agent_error",
        clientVersion: "1.7.2",
      },
    );
    expect(JSON.stringify(submit.mock.calls[0])).not.toContain("alice@example.com");
    expect(JSON.stringify(submit.mock.calls[0])).not.toContain("/Users/alice");
    expect(JSON.stringify(submit.mock.calls[0])).not.toContain("do not collect");
  });

  it("sends normalized Antigravity metadata without raw payload after opt-in", async () => {
    const submit = vi.fn(async () => undefined);
    const receiver = createLocalHookReceiver({
      port: 0,
      sendSignals: true,
      readConfig: () => ({
        ...baseConfig,
        serviceIds: ["google-antigravity-cli"],
        localHookSignalOptIn: true,
      }),
      submit,
    });
    receivers.push(receiver);
    const address = await receiver.start();

    const response = await postHook(address.port, {
      rawHook: "antigravity",
      payload: {
        hook_event_name: "Stop",
        service_id: "google-antigravity-cli",
        termination_reason: "error",
        has_error: true,
        fully_idle: true,
        client_version: "2.0.1",
        workspacePaths: ["/Users/alice/private-project"],
        transcriptPath: "/Users/alice/.gemini/antigravity-cli/transcript.jsonl",
        error: "raw provider or local error text for alice@example.com",
      },
    });

    expect(response.status).toBe(202);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceIds: ["google-antigravity-cli"],
      }),
      {
        serviceId: "google-antigravity-cli",
        source: "cli_hook",
        symptom: "error",
        errorCode: "antigravity_agent_error",
        clientVersion: "2.0.1",
      },
    );
    expect(JSON.stringify(submit.mock.calls[0])).not.toContain("alice@example.com");
    expect(JSON.stringify(submit.mock.calls[0])).not.toContain("/Users/alice");
    expect(JSON.stringify(submit.mock.calls[0])).not.toContain("raw provider");
  });
});

const baseConfig: CliConfig = {
  configVersion: 1,
  baseUrl: "http://localhost:3000",
  collectorId: "col_test",
  collectorToken: "njy_secret",
  source: "cli_hook",
  serviceIds: ["anthropic-claude-code"],
  clientName: "notjustyou-cli",
  clientVersion: "0.3.0",
  localReceiverToken: "receiver-secret",
};

function validHook() {
  return {
    serviceId: "anthropic-claude-code",
    surface: "claude-code",
    eventName: "StopFailure",
    symptom: "rate_limited",
    statusCode: 500,
    errorCode: "claude_rate_limit",
  };
}

function postHook(port: number, body: unknown) {
  return fetch(`http://127.0.0.1:${port}/hook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...receiverHeaders(),
    },
    body: JSON.stringify(body),
  });
}

function receiverHeaders() {
  return { "x-notjustyou-receiver-token": "receiver-secret" };
}

function postHookWithHost(port: number, host: string) {
  return new Promise<number | undefined>((resolve, reject) => {
    const request = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/hook",
        method: "POST",
        headers: {
          ...receiverHeaders(),
          "content-type": "application/json",
          host,
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      },
    );
    request.on("error", reject);
    request.end("{}");
  });
}
