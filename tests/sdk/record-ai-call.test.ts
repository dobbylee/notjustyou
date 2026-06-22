import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordAiCall } from "@/packages/notjustyou-sdk-js/src/index";

const originalConfigPath = process.env.NOTJUSTYOU_CONFIG_PATH;

beforeEach(() => {
  process.env.NOTJUSTYOU_CONFIG_PATH = join(
    mkdtempSync(join(tmpdir(), "njy-sdk-test-")),
    "config.json",
  );
});

afterEach(() => {
  process.env.NOTJUSTYOU_CONFIG_PATH = originalConfigPath;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("recordAiCall", () => {
  it("returns successful values unchanged without a slow threshold signal", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();

    await expect(
      recordAiCall({ serviceId: "openai-api" }, () => Promise.resolve("ok")),
    ).resolves.toBe("ok");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rethrows the original provider error and sends a rate limited signal", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();
    const providerError = Object.assign(new Error("do not send this message"), {
      status: 429,
      code: "rate_limit_exceeded",
      headers: { authorization: "secret" },
      request: { body: "prompt" },
    });

    await expect(
      recordAiCall({ serviceId: "openai-api" }, () => {
        throw providerError;
      }),
    ).rejects.toBe(providerError);

    await waitForSignalTask();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3000/api/signals");
    expect(init.headers).toMatchObject({
      authorization: "Bearer njy_test_token",
      "content-type": "application/json",
    });

    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({
      serviceId: "openai-api",
      source: "api_middleware",
      symptom: "rate_limited",
      statusCode: 429,
      errorCode: "rate_limit_exceeded",
      clientVersion: "0.1.0",
    });
    expect(payload.installationId).toEqual(expect.any(String));
    expect(JSON.stringify(payload)).not.toContain("do not send this message");
    expect(JSON.stringify(payload)).not.toContain("authorization");
    expect(JSON.stringify(payload)).not.toContain("prompt");
  });

  it("maps OpenAI 5xx errors to error", async () => {
    const payload = await captureFailurePayload({ statusCode: 503, type: "server_error" });

    expect(payload).toMatchObject({
      symptom: "error",
      statusCode: 503,
      errorCode: "server_error",
    });
  });

  it("maps timeout and network failures to network_error", async () => {
    const payload = await captureFailurePayload({
      name: "TimeoutError",
      code: "ETIMEDOUT",
    });

    expect(payload).toMatchObject({
      symptom: "network_error",
      errorCode: "ETIMEDOUT",
    });
    expect(payload).not.toHaveProperty("statusCode");
  });

  it("maps OpenAI SDK connection failures to network_error", async () => {
    const payload = await captureFailurePayload({
      name: "APIConnectionError",
    });

    expect(payload).toMatchObject({
      symptom: "network_error",
      errorCode: "APIConnectionError",
    });
  });

  it("sends an opt-in slow signal when duration crosses the threshold", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();

    await expect(
      recordAiCall({ serviceId: "openai-api", slowAfterMs: 0 }, () => "ok"),
    ).resolves.toBe("ok");

    await waitForSignalTask();

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload).toMatchObject({
      serviceId: "openai-api",
      source: "api_middleware",
      symptom: "slow",
    });
  });

  it("does not send when config is missing or not allowlisted", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      recordAiCall({ serviceId: "openai-api", slowAfterMs: 0 }, () => "ok"),
    ).resolves.toBe("ok");

    await waitForSignalTask();

    writeConfig({ source: "cli_hook" });

    await expect(
      recordAiCall({ serviceId: "openai-api", slowAfterMs: 0 }, () => "ok"),
    ).resolves.toBe("ok");

    await waitForSignalTask();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not send for a non-OpenAI service id at runtime", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();

    await expect(
      recordAiCall(
        { serviceId: "anthropic-claude-api", slowAfterMs: 0 } as never,
        () => "ok",
      ),
    ).resolves.toBe("ok");

    await waitForSignalTask();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not send authorization to a base URL that differs from config", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    writeConfig({ baseUrl: "https://notjustyou.dev" });

    await expect(
      recordAiCall(
        { serviceId: "openai-api", slowAfterMs: 0, baseUrl: "http://localhost:3000" },
        () => "ok",
      ),
    ).resolves.toBe("ok");

    await waitForSignalTask();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates and reuses a random installation id in local config", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();

    await recordAiCall({ serviceId: "openai-api", slowAfterMs: 0 }, () => "first");
    await waitForSignalTask();
    await recordAiCall({ serviceId: "openai-api", slowAfterMs: 0 }, () => "second");
    await waitForSignalTask();

    const firstPayload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const secondPayload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    const storedConfig = JSON.parse(readFileSync(process.env.NOTJUSTYOU_CONFIG_PATH!, "utf8"));

    expect(firstPayload.installationId).toEqual(secondPayload.installationId);
    expect(storedConfig.installationId).toEqual(firstPayload.installationId);
    expect(storedConfig.installationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(statSync(process.env.NOTJUSTYOU_CONFIG_PATH!).mode & 0o777).toBe(0o600);
  });

  it("suppresses signal submission failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("collector unavailable");
      }),
    );
    writeConfig();

    await expect(
      recordAiCall({ serviceId: "openai-api", slowAfterMs: 0 }, () => "ok"),
    ).resolves.toBe("ok");

    await waitForSignalTask();
  });

  it("defers config writes until after returning the wrapped value", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();

    const result = await recordAiCall(
      { serviceId: "openai-api", slowAfterMs: 0 },
      () => "ok",
    );

    expect(result).toBe("ok");
    expect(readStoredConfig()).not.toHaveProperty("installationId");
    expect(fetchMock).not.toHaveBeenCalled();

    await waitForSignalTask();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readStoredConfig()).toHaveProperty("installationId");
  });

  it("defers config writes until after rethrowing the original provider error", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();
    const providerError = Object.assign(new Error("not collected"), {
      name: "APIConnectionTimeoutError",
    });

    await expect(
      recordAiCall({ serviceId: "openai-api" }, () => {
        throw providerError;
      }),
    ).rejects.toBe(providerError);

    expect(readStoredConfig()).not.toHaveProperty("installationId");
    expect(fetchMock).not.toHaveBeenCalled();

    await waitForSignalTask();

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload).toMatchObject({
      symptom: "network_error",
      errorCode: "APIConnectionTimeoutError",
    });
    expect(readStoredConfig()).toHaveProperty("installationId");
  });
});

async function captureFailurePayload(errorShape: Record<string, unknown>) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", fetchMock);
  writeConfig();
  const providerError = Object.assign(new Error("not collected"), errorShape);

  await expect(
    recordAiCall({ serviceId: "openai-api" }, () => {
      throw providerError;
    }),
  ).rejects.toBe(providerError);

  await waitForSignalTask();

  return JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
}

async function waitForSignalTask() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function writeConfig(overrides: Record<string, unknown> = {}) {
  writeFileSync(
    process.env.NOTJUSTYOU_CONFIG_PATH!,
    `${JSON.stringify(
      {
        configVersion: 1,
        baseUrl: "http://localhost:3000",
        collectorId: "col_test",
        collectorToken: "njy_test_token",
        source: "api_middleware",
        serviceIds: ["openai-api"],
        clientName: "notjustyou-cli",
        clientVersion: "0.1.0",
        ...overrides,
      },
      null,
      2,
    )}\n`,
    {
      mode: 0o600,
    },
  );
}

function readStoredConfig() {
  return JSON.parse(readFileSync(process.env.NOTJUSTYOU_CONFIG_PATH!, "utf8"));
}
