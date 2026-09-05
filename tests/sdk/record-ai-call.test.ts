import { createTempDir } from "@/tests/helpers/temp-dir";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordAiCall } from "@/packages/notjustyou-sdk-js/src/index";
import {
  enqueueSignal,
  getSignalQueueSnapshot,
  resetSignalQueueForTests,
  scheduleSignalQueueDrain,
} from "@/packages/notjustyou-sdk-js/src/queue";
import type { ProblemSignalPayload } from "@/packages/notjustyou-sdk-js/src/types";

beforeEach(() => {
  vi.stubEnv("NOTJUSTYOU_CONFIG_PATH", join(
    createTempDir("njy-sdk-test-"),
    "config.json",
  ));
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetSignalQueueForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
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
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true })));
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
    expect(payload.signalId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
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

  it("maps Anthropic overloaded and server errors to error", async () => {
    const overloaded = await captureFailurePayload(
      {
        status: 529,
        type: "overloaded_error",
      },
      "anthropic-claude-api",
      ["anthropic-claude-api"],
    );
    const server = await captureFailurePayload(
      {
        status: 500,
        error: { type: "api_error" },
      },
      "anthropic-claude-api",
      ["anthropic-claude-api"],
    );

    expect(overloaded).toMatchObject({
      serviceId: "anthropic-claude-api",
      symptom: "error",
      statusCode: 529,
      errorCode: "overloaded_error",
    });
    expect(server).toMatchObject({
      serviceId: "anthropic-claude-api",
      symptom: "error",
      statusCode: 500,
      errorCode: "api_error",
    });
  });

  it("maps Anthropic auth and billing errors to auth_error", async () => {
    const auth = await captureFailurePayload(
      {
        status: 401,
        type: "authentication_error",
      },
      "anthropic-claude-api",
      ["anthropic-claude-api"],
    );
    const billing = await captureFailurePayload(
      {
        status: 400,
        type: "billing_error",
      },
      "anthropic-claude-api",
      ["anthropic-claude-api"],
    );

    expect(auth).toMatchObject({
      symptom: "auth_error",
      statusCode: 401,
      errorCode: "authentication_error",
    });
    expect(billing).toMatchObject({
      symptom: "auth_error",
      statusCode: 400,
      errorCode: "billing_error",
    });
  });

  it("maps Gemini quota and rate errors to rate_limited", async () => {
    const quota = await captureFailurePayload(
      {
        error: {
          code: 429,
          status: "RESOURCE_EXHAUSTED",
          message: "do not collect",
        },
      },
      "google-gemini-api",
      ["google-gemini-api"],
    );
    const rate = await captureFailurePayload(
      {
        status: 429,
        code: "rateLimitExceeded",
      },
      "google-gemini-api",
      ["google-gemini-api"],
    );

    expect(quota).toMatchObject({
      symptom: "rate_limited",
      statusCode: 429,
      errorCode: "RESOURCE_EXHAUSTED",
    });
    expect(rate).toMatchObject({
      symptom: "rate_limited",
      statusCode: 429,
      errorCode: "rateLimitExceeded",
    });
  });

  it("maps Gemini model unavailable errors to model_unavailable", async () => {
    const payload = await captureFailurePayload(
      {
        error: {
          code: 404,
          status: "MODEL_NOT_FOUND",
          message: "do not collect",
        },
      },
      "google-gemini-api",
      ["google-gemini-api"],
    );

    expect(payload).toMatchObject({
      serviceId: "google-gemini-api",
      symptom: "model_unavailable",
      statusCode: 404,
      errorCode: "MODEL_NOT_FOUND",
    });
  });

  it("maps Gemini 404 errors without provider status to model_unavailable", async () => {
    const payload = await captureFailurePayload(
      {
        status: 404,
      },
      "google-gemini-api",
      ["google-gemini-api"],
    );

    expect(payload).toMatchObject({
      serviceId: "google-gemini-api",
      symptom: "model_unavailable",
      statusCode: 404,
    });
    expect(payload).not.toHaveProperty("errorCode");
  });

  it("does not send provider-specific sensitive fixture fields", async () => {
    const payload = await captureFailurePayload(
      {
        status: 429,
        error: {
          status: "RESOURCE_EXHAUSTED",
          message: "prompt leaked in provider message",
          response: { body: "completion" },
        },
        request: { body: "prompt" },
        response: { body: "completion" },
        headers: { authorization: "secret" },
        token: "secret-token",
        code: "quota exceeded",
        diff: "private diff",
        fileContent: "private file",
        email: "person@example.com",
      },
      "google-gemini-api",
      ["google-gemini-api"],
    );
    const serialized = JSON.stringify(payload);

    expect(payload).toMatchObject({
      serviceId: "google-gemini-api",
      symptom: "rate_limited",
      statusCode: 429,
      errorCode: "RESOURCE_EXHAUSTED",
    });
    expect(serialized).not.toContain("prompt");
    expect(serialized).not.toContain("completion");
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("quota exceeded");
    expect(serialized).not.toContain("private diff");
    expect(serialized).not.toContain("private file");
    expect(serialized).not.toContain("person@example.com");
  });

  it.each([
    "sk-proj-1234567890SECRET",
    "person@example.com",
    "/Users/person/project/error.ts",
    "C:\\Users\\person\\project\\error.ts",
    "src/private/error.ts",
  ])("drops a sensitive or path-like provider error code: %s", async (code) => {
    const payload = await captureFailurePayload({ status: 500, code });

    expect(payload).not.toHaveProperty("errorCode");
  });

  it("sends an opt-in slow signal when duration crosses the threshold", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true })));
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

  it("does not send for an unsupported service id at runtime", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();

    await expect(
      recordAiCall(
        { serviceId: "anthropic-claude-code", slowAfterMs: 0 } as never,
        () => "ok",
      ),
    ).resolves.toBe("ok");

    await waitForSignalTask();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not enqueue supported services missing from the config allowlist", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    writeConfig({ serviceIds: ["openai-api"] });

    const providerError = Object.assign(new Error("not collected"), {
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
      },
    });

    await expect(
      recordAiCall({ serviceId: "google-gemini-api" }, () => {
        throw providerError;
      }),
    ).rejects.toBe(providerError);

    await waitForSignalTask();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getSignalQueueSnapshot()).toHaveLength(0);
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
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();

    await recordAiCall({ serviceId: "openai-api", slowAfterMs: 0 }, () => "first");
    await waitForSignalTask();
    const providerError = Object.assign(new Error("not collected"), {
      status: 503,
      code: "server_error",
    });
    await expect(
      recordAiCall({ serviceId: "openai-api" }, () => {
        throw providerError;
      }),
    ).rejects.toBe(providerError);
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

  it("retries signal submission using retryAfterSeconds without retrying the wrapped call", async () => {
    vi.useFakeTimers();
    const providerCall = vi.fn(() => {
      throw Object.assign(new Error("not collected"), { status: 429 });
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, retryAfterSeconds: 2 }), {
          status: 429,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();

    await expect(recordAiCall({ serviceId: "openai-api" }, providerCall)).rejects.toThrow(
      "not collected",
    );
    expect(providerCall).toHaveBeenCalledTimes(1);

    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(providerCall).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(providerCall).toHaveBeenCalledTimes(1);
  });

  it("does not retry queued signals to a changed config base URL", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, retryAfterSeconds: 2 }), {
          status: 429,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    writeConfig({ baseUrl: "http://localhost:3000" });
    const providerError = Object.assign(new Error("not collected"), {
      status: 429,
      code: "rate_limit_exceeded",
    });

    await expect(
      recordAiCall(
        { serviceId: "openai-api", baseUrl: "http://localhost:3000" },
        () => {
          throw providerError;
        },
      ),
    ).rejects.toBe(providerError);

    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    writeConfig({
      baseUrl: "http://127.0.0.1:3000",
      installationId: readStoredConfig().installationId,
    });

    await vi.advanceTimersByTimeAsync(2000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getSignalQueueSnapshot()).toHaveLength(0);
  });

  it("keeps queued base URL guards per entry when a later signal changes the active sender", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, retryAfterSeconds: 2 }), {
          status: 429,
        }),
      )
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    writeConfig({ baseUrl: "http://localhost:3000" });
    const providerError = Object.assign(new Error("not collected"), {
      status: 429,
      code: "rate_limit_exceeded",
    });

    await expect(
      recordAiCall(
        { serviceId: "openai-api", baseUrl: "http://localhost:3000" },
        () => {
          throw providerError;
        },
      ),
    ).rejects.toBe(providerError);

    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    writeConfig({
      baseUrl: "http://127.0.0.1:3000",
      installationId: readStoredConfig().installationId,
    });
    await recordAiCall(
      { serviceId: "openai-api", slowAfterMs: 0, baseUrl: "http://127.0.0.1:3000" },
      () => "ok",
    );

    await vi.runOnlyPendingTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[0]).toBe(
      "http://localhost:3000/api/signals",
    );
    expect((fetchMock.mock.calls[1] as [string, RequestInit])[0]).toBe(
      "http://127.0.0.1:3000/api/signals",
    );
    expect(getSignalQueueSnapshot()).toHaveLength(0);
  });

  it("does not delay new ready signals behind an existing retry timer", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, retryAfterSeconds: 30 }), {
          status: 429,
        }),
      )
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();
    const firstError = Object.assign(new Error("first"), {
      status: 429,
      code: "rate_limit_a",
    });
    const secondError = Object.assign(new Error("second"), {
      status: 429,
      code: "rate_limit_b",
    });

    await expect(
      recordAiCall({ serviceId: "openai-api" }, () => {
        throw firstError;
      }),
    ).rejects.toBe(firstError);

    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(
      recordAiCall({ serviceId: "openai-api" }, () => {
        throw secondError;
      }),
    ).rejects.toBe(secondError);

    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stores only sanitized signal payloads while queued for retry", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();
    const providerError = Object.assign(new Error("do not store"), {
      status: 503,
      code: "server_error",
      headers: { authorization: "secret" },
      request: { body: "prompt" },
      response: { body: "completion" },
    });

    await expect(
      recordAiCall({ serviceId: "openai-api" }, () => {
        throw providerError;
      }),
    ).rejects.toBe(providerError);

    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();

    const queued = getSignalQueueSnapshot();
    expect(queued).toHaveLength(1);
    expect(queued[0].attempts).toBe(1);
    expect(queued[0].payload).toMatchObject({
      serviceId: "openai-api",
      source: "api_middleware",
      symptom: "error",
      statusCode: 503,
      errorCode: "server_error",
    });
    expect(JSON.stringify(queued)).not.toContain("do not store");
    expect(JSON.stringify(queued)).not.toContain("authorization");
    expect(JSON.stringify(queued)).not.toContain("prompt");
    expect(JSON.stringify(queued)).not.toContain("completion");
  });

  it("coalesces repeated identical local failures within the suppression window", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();
    const firstError = Object.assign(new Error("first"), {
      status: 503,
      code: "server_error",
    });
    const secondError = Object.assign(new Error("second"), {
      status: 503,
      code: "server_error",
    });

    await expect(
      recordAiCall({ serviceId: "openai-api" }, () => {
        throw firstError;
      }),
    ).rejects.toBe(firstError);
    await expect(
      recordAiCall({ serviceId: "openai-api" }, () => {
        throw secondError;
      }),
    ).rejects.toBe(secondError);

    await waitForSignalTask();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not coalesce opt-in slow signals", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();

    await recordAiCall({ serviceId: "openai-api", slowAfterMs: 0 }, () => "first");
    await recordAiCall({ serviceId: "openai-api", slowAfterMs: 0 }, () => "second");

    await waitForSignalTask();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("allows repeated failure signals after the suppression window expires", () => {
    expect(enqueueSignal(makePayload(), 1000)).toBe(true);
    expect(enqueueSignal(makePayload(), 1000 + 29_999)).toBe(false);
    expect(enqueueSignal(makePayload(), 1000 + 30_000)).toBe(true);
  });

  it("does not coalesce distinct failure keys", () => {
    expect(enqueueSignal(makePayload({ errorCode: "server_error_a" }), 1000)).toBe(true);
    expect(enqueueSignal(makePayload({ errorCode: "server_error_b" }), 1000)).toBe(true);

    expect(getSignalQueueSnapshot()).toHaveLength(2);
  });

  it("keeps the in-memory queue bounded", () => {
    for (let index = 0; index < 60; index += 1) {
      enqueueSignal(makePayload({ errorCode: `server_error_${index}` }), 1000 + index);
    }

    const queued = getSignalQueueSnapshot();
    expect(queued).toHaveLength(50);
    expect(queued[0].payload.errorCode).toBe("server_error_10");
    expect(queued[49].payload.errorCode).toBe("server_error_59");
  });

  it("drops non-retryable signal responses", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: false }), { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();
    const providerError = Object.assign(new Error("not collected"), {
      status: 503,
      code: "server_error",
    });

    await expect(
      recordAiCall({ serviceId: "openai-api" }, () => {
        throw providerError;
      }),
    ).rejects.toBe(providerError);

    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getSignalQueueSnapshot()).toHaveLength(0);
  });

  it("drops queued signals after max attempts", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: false }), { status: 503 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    writeConfig();
    const providerError = Object.assign(new Error("not collected"), {
      status: 503,
      code: "server_error",
    });

    await expect(
      recordAiCall({ serviceId: "openai-api" }, () => {
        throw providerError;
      }),
    ).rejects.toBe(providerError);

    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(1200);
    await vi.advanceTimersByTimeAsync(2400);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getSignalQueueSnapshot()).toHaveLength(0);
  });

  it("caps retry scheduling at queue TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    enqueueSignal(makePayload(), Date.now());

    scheduleSignalQueueDrain(async () => {
      throw {
        retryable: true,
        retryAfterMs: 60 * 60 * 1000,
      };
    });

    await vi.runOnlyPendingTimersAsync();

    const queued = getSignalQueueSnapshot();
    expect(queued).toHaveLength(1);
    expect(queued[0].nextAttemptAt).toBe(queued[0].expiresAt);
  });

  it("uses jittered exponential backoff when retryAfterSeconds is absent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    enqueueSignal(makePayload(), Date.now());

    scheduleSignalQueueDrain(async () => {
      throw {
        retryable: true,
      };
    });

    await vi.runOnlyPendingTimersAsync();

    const queued = getSignalQueueSnapshot();
    expect(queued).toHaveLength(1);
    expect(queued[0].nextAttemptAt - Date.now()).toBe(1100);
  });

  it("keeps one signal id across retries", async () => {
    vi.useFakeTimers();
    const payloads: ProblemSignalPayload[] = [];
    enqueueSignal(makePayload({ signalId: "signal-test" }), Date.now());

    scheduleSignalQueueDrain(async (payload) => {
      payloads.push(payload);
      if (payloads.length === 1) throw { retryable: true, retryAfterMs: 1 };
    });

    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    expect(payloads.map((payload) => payload.signalId)).toEqual([
      "signal-test",
      "signal-test",
    ]);
  });

  it("does not keep a child process open for a delayed retry", () => {
    const queueModule = pathToFileURL(
      join(process.cwd(), "packages/notjustyou-sdk-js/src/queue.ts"),
    ).href;
    const script = `
      import { drainSignalQueue, enqueueSignal } from ${JSON.stringify(queueModule)};
      const payload = {
        serviceId: "openai-api",
        source: "api_middleware",
        symptom: "error",
        observedAt: new Date().toISOString(),
        durationMs: 1,
        installationId: "installation-test",
        clientVersion: "0.1.1",
        signalId: "signal-test-1234"
      };
      enqueueSignal(payload, Date.now(), async () => {
        throw { retryable: true, retryAfterMs: 60_000 };
      });
      await drainSignalQueue();
    `;

    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--input-type=module", "--eval", script],
      { encoding: "utf8", timeout: 2_000 },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });

  it("defers config writes until after returning the wrapped value", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true })));
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
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true })));
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

async function captureFailurePayload(
  errorShape: Record<string, unknown>,
  serviceId: "anthropic-claude-api" | "google-gemini-api" | "openai-api" = "openai-api",
  serviceIds: string[] = ["openai-api"],
) {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", fetchMock);
  writeConfig({ serviceIds });
  const providerError = Object.assign(new Error("not collected"), errorShape);

  await expect(
    recordAiCall({ serviceId }, () => {
      throw providerError;
    }),
  ).rejects.toBe(providerError);

  await waitForSignalTask();

  return JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
}

async function waitForSignalTask() {
  await new Promise((resolve) => setTimeout(resolve, 0));
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

function makePayload(overrides: Partial<ProblemSignalPayload> = {}): ProblemSignalPayload {
  return {
    serviceId: "openai-api",
    source: "api_middleware",
    symptom: "error",
    observedAt: "2026-06-22T00:00:00.000Z",
    durationMs: 100,
    statusCode: 503,
    errorCode: "server_error",
    installationId: "installation-test",
    signalId: "signal-test",
    clientVersion: "0.1.0",
    ...overrides,
  };
}
