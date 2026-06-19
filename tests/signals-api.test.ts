import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as registerCollector } from "@/app/api/collectors/register/route";
import { POST as submitHeartbeat } from "@/app/api/collectors/heartbeat/route";
import { POST as submitSignal } from "@/app/api/signals/route";
import { GET as getSignalSummary } from "@/app/api/signals/summary/route";
import type { CollectorRecord } from "@/lib/signals/collectors";

const storage = {
  registerCollector: vi.fn(async () => undefined),
  findCollectorByToken: vi.fn(async () => null as CollectorRecord | null),
  recordHeartbeat: vi.fn(async () => undefined),
  checkRegistrationRateLimit: vi.fn(async () => ({
    allowed: true,
    retryAfterSeconds: 60,
  })),
  checkSignalRateLimits: vi.fn(async () => ({
    allowed: true,
    retryAfterSeconds: 60,
  })),
  checkHeartbeatRateLimits: vi.fn(async () => ({
    allowed: true,
    retryAfterSeconds: 60,
  })),
  recordSignal: vi.fn(async () => undefined),
  getSignalSummary: vi.fn(async () => ({
    windowMinutes: 10,
    updatedAt: "2026-06-19T01:00:00.000Z",
    services: [],
  })),
};

vi.mock("@/lib/storage", () => ({
  getSignalStorage: vi.fn(async () => storage),
}));

const collector: CollectorRecord = {
  collectorId: "col_123",
  source: "api_middleware",
  serviceIds: ["openai-api"],
  clientName: "notjustyou-sdk-js",
  clientVersion: "0.1.0",
  createdAt: "2026-06-19T01:00:00.000Z",
  revokedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  storage.findCollectorByToken.mockResolvedValue(collector);
  storage.checkRegistrationRateLimit.mockResolvedValue({
    allowed: true,
    retryAfterSeconds: 60,
  });
  storage.checkSignalRateLimits.mockResolvedValue({
    allowed: true,
    retryAfterSeconds: 60,
  });
  storage.checkHeartbeatRateLimits.mockResolvedValue({
    allowed: true,
    retryAfterSeconds: 60,
  });
  storage.getSignalSummary.mockResolvedValue({
    windowMinutes: 10,
    updatedAt: "2026-06-19T01:00:00.000Z",
    services: [],
  });
});

describe("signals API", () => {
  it("registers a collector without returning storage internals", async () => {
    const response = await registerCollector(
      jsonRequest("http://localhost/api/collectors/register", {
        source: "api_middleware",
        serviceIds: ["openai-api"],
        clientName: "notjustyou-sdk-js",
        clientVersion: "0.1.0",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.collectorId).toMatch(/^col_/);
    expect(body.collectorToken).toMatch(/^njy_/);
    expect(body.expiresAt).toBeNull();
    expect(storage.registerCollector).toHaveBeenCalledTimes(1);
  });

  it("applies registration abuse guard", async () => {
    storage.checkRegistrationRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
    });

    const response = await registerCollector(
      jsonRequest("http://localhost/api/collectors/register", {
        source: "api_middleware",
        serviceIds: ["openai-api"],
        clientName: "notjustyou-sdk-js",
        clientVersion: "0.1.0",
      }),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: 60,
    });
  });

  it("rejects invalid, revoked, wrong-source, and wrong-service signal tokens", async () => {
    storage.findCollectorByToken.mockResolvedValueOnce(null);
    expect(
      (
        await submitSignal(
          signalRequest({
            serviceId: "openai-api",
            source: "api_middleware",
            symptom: "error",
          }),
        )
      ).status,
    ).toBe(401);

    storage.findCollectorByToken.mockResolvedValueOnce({
      ...collector,
      revokedAt: "2026-06-19T01:00:00.000Z",
    });
    expect(
      (
        await submitSignal(
          signalRequest({
            serviceId: "openai-api",
            source: "api_middleware",
            symptom: "error",
          }),
        )
      ).status,
    ).toBe(403);

    expect(
      (
        await submitSignal(
          signalRequest({
            serviceId: "openai-api",
            source: "cli_hook",
            symptom: "error",
          }),
        )
      ).status,
    ).toBe(400);

    expect(
      (
        await submitSignal(
          signalRequest({
            serviceId: "anthropic-claude-api",
            source: "api_middleware",
            symptom: "error",
          }),
        )
      ).status,
    ).toBe(400);
  });

  it("rejects sensitive payloads before accepting valid metadata-only signals", async () => {
    const sensitiveResponse = await submitSignal(
      signalRequest({
        serviceId: "openai-api",
        source: "api_middleware",
        symptom: "error",
        nested: {
          prompt: "do not collect",
        },
      }),
    );

    expect(sensitiveResponse.status).toBe(400);
    expect(await sensitiveResponse.json()).toMatchObject({
      ok: false,
      reason: "sensitive_payload",
    });

    const validResponse = await submitSignal(
      signalRequest({
        serviceId: "openai-api",
        source: "api_middleware",
        symptom: "rate_limited",
        durationMs: 1200,
        statusCode: 429,
        errorCode: "rate_limit_exceeded",
        installationId: "random-local-id",
        clientVersion: "0.1.0",
      }),
    );

    expect(validResponse.status).toBe(200);
    expect(await validResponse.json()).toMatchObject({
      ok: true,
    });
    expect(storage.recordSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: expect.objectContaining({
          collectorId: "col_123",
          serviceId: "openai-api",
          source: "api_middleware",
          symptom: "rate_limited",
        }),
      }),
    );
  });

  it("rejects timestamp skew and rate-limited signals", async () => {
    const oldResponse = await submitSignal(
      signalRequest({
        serviceId: "openai-api",
        source: "api_middleware",
        symptom: "error",
        observedAt: "2020-01-01T00:00:00.000Z",
      }),
    );

    expect(oldResponse.status).toBe(400);
    expect(await oldResponse.json()).toMatchObject({
      ok: false,
      reason: "observed_at_too_old",
    });

    storage.checkSignalRateLimits.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
    });

    const rateLimitedResponse = await submitSignal(
      signalRequest({
        serviceId: "openai-api",
        source: "api_middleware",
        symptom: "error",
      }),
    );

    expect(rateLimitedResponse.status).toBe(429);
    expect(await rateLimitedResponse.json()).toMatchObject({
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: 60,
    });
  });

  it("records heartbeat using collector auth", async () => {
    const response = await submitHeartbeat(
      jsonRequest(
        "http://localhost/api/collectors/heartbeat",
        {
          installationId: "random-local-id",
          clientVersion: "0.1.0",
        },
        {
          authorization: "Bearer njy_token",
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(storage.recordHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        collectorId: "col_123",
        installationId: "random-local-id",
      }),
    );
  });

  it("rate-limits heartbeat writes", async () => {
    storage.checkHeartbeatRateLimits.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
    });

    const response = await submitHeartbeat(
      jsonRequest(
        "http://localhost/api/collectors/heartbeat",
        {
          installationId: "random-local-id",
          clientVersion: "0.1.0",
        },
        {
          authorization: "Bearer njy_token",
        },
      ),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: 60,
    });
    expect(storage.recordHeartbeat).not.toHaveBeenCalled();
  });

  it("returns installed-client signal summaries only", async () => {
    storage.getSignalSummary.mockResolvedValue({
      windowMinutes: 10,
      updatedAt: "2026-06-19T01:00:00.000Z",
      services: [
        {
          serviceId: "openai-api",
          countsBySource: {
            api_middleware: 1,
            cli_hook: 0,
            ide_extension: 0,
            browser_extension: 0,
            mcp_monitor: 0,
            local_probe: 0,
          },
          countsBySymptom: {
            slow: 0,
            error: 0,
            down: 0,
            rate_limited: 1,
            auth_error: 0,
            model_unavailable: 0,
            network_error: 0,
            tool_failure: 0,
            permission_blocked: 0,
            unknown: 0,
          },
          total: 1,
          uniqueInstallationsApprox: 1,
          lastSignal: {
            symptom: "rate_limited",
            source: "api_middleware",
            observedAt: "2026-06-19T01:00:00.000Z",
          },
        },
      ],
    });

    const response = await getSignalSummary(
      new NextRequest("http://localhost/api/signals/summary?serviceId=openai-api"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.services[0].serviceId).toBe("openai-api");
    expect(body.services[0].total).toBe(1);
    expect(body.services[0].counts).toBeUndefined();
  });
});

function signalRequest(body: Record<string, unknown>) {
  return jsonRequest("http://localhost/api/signals", body, {
    authorization: "Bearer njy_token",
  });
}

function jsonRequest(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
