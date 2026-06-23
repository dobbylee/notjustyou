import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertLocalReceiverHost,
  createLocalHookReceiver,
  getHookSendReadiness,
} from "@/packages/notjustyou-cli/src/receiver";
import type { CliConfig } from "@/packages/notjustyou-cli/src/types";

const receivers: Array<ReturnType<typeof createLocalHookReceiver>> = [];

afterEach(async () => {
  await Promise.all(receivers.map((receiver) => receiver.close()));
  receivers.length = 0;
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

  it("accepts metadata-only hook events without sending by default", async () => {
    const submit = vi.fn();
    const receiver = createLocalHookReceiver({
      port: 0,
      submit,
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
      clientVersion: "0.2.0",
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
        clientVersion: "0.2.0",
      },
    });
    expect(response.status).toBe(202);
    expect(submit).not.toHaveBeenCalled();
  });

  it("rejects unknown and sensitive hook fields", async () => {
    const receiver = createLocalHookReceiver({
      port: 0,
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
          serviceId: "openai-codex-cli",
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
          serviceId: "openai-codex-cli",
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
          serviceIds: ["anthropic-claude-code"],
          localHookSignalOptIn: true,
        },
        {
          serviceId: "openai-codex-cli",
          source: "cli_hook",
          symptom: "error",
        },
      ),
    ).toEqual({
      ok: false,
      reason: "Collector config does not allow this serviceId.",
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
        serviceId: "openai-codex-cli",
        source: "cli_hook",
        symptom: "tool_failure",
        statusCode: 500,
        errorCode: "tool_failed",
      },
    );
    expect(JSON.stringify(submit.mock.calls[0])).not.toContain("run.failed");
    expect(JSON.stringify(submit.mock.calls[0])).not.toContain("surface");
  });
});

const baseConfig: CliConfig = {
  configVersion: 1,
  baseUrl: "http://localhost:3000",
  collectorId: "col_test",
  collectorToken: "njy_secret",
  source: "cli_hook",
  serviceIds: ["openai-codex-cli"],
  clientName: "notjustyou-cli",
  clientVersion: "0.2.0",
};

function validHook() {
  return {
    serviceId: "openai-codex-cli",
    surface: "codex-cli",
    eventName: "run.failed",
    symptom: "tool_failure",
    statusCode: 500,
    errorCode: "tool_failed",
  };
}

function postHook(port: number, body: unknown) {
  return fetch(`http://127.0.0.1:${port}/hook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
