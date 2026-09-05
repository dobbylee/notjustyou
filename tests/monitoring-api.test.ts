import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getHealth } from "@/app/api/health/route";
import { GET as getMonitoring } from "@/app/api/monitoring/route";

const redis = {
  ping: vi.fn(async () => "PONG"),
};
const reportStorage = {
  getSummary: vi.fn(async () => ({
    windowMinutes: 10,
    updatedAt: "2026-06-19T01:00:00.000Z",
    services: [
      {
        serviceId: "openai-api",
        counts: {
          slow: 0,
          error: 1,
          down: 0,
        },
        total: 1,
        communityState: "reports_seen",
      },
    ],
  })),
  getClickSummary: vi.fn(async () => ({
    windowHours: 168,
    updatedAt: "2026-06-19T01:00:00.000Z",
    metrics: [
      {
        id: "provider_tab:openai",
        event: "provider_tab",
        label: "OpenAI tab",
        total: 2,
      },
    ],
  })),
};
const signalStorage = {
  getSignalSummary: vi.fn(async () => ({
    windowMinutes: 10,
    updatedAt: "2026-06-19T01:00:00.000Z",
    services: [
      {
        serviceId: "openai-api",
        countsBySource: {
          api_middleware: 3,
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
          rate_limited: 3,
          auth_error: 0,
          model_unavailable: 0,
          network_error: 0,
          tool_failure: 0,
          permission_blocked: 0,
          unknown: 0,
        },
        total: 3,
        uniqueInstallationsApprox: 1,
        lastSignal: null,
      },
    ],
  })),
};

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(async () => redis),
}));

vi.mock("@/lib/storage", () => ({
  getReportStorage: vi.fn(async () => reportStorage),
  getSignalStorage: vi.fn(async () => signalStorage),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ANALYTICS_READ_TOKEN", "test-token");
});

describe("health API", () => {
  it("reports Redis availability", async () => {
    const response = await getHealth();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      redis: "ok",
    });
  });

  it("returns 503 when Redis is unavailable", async () => {
    redis.ping.mockRejectedValueOnce(new Error("down"));

    const response = await getHealth();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      redis: "unavailable",
    });
  });
});

describe("monitoring API", () => {
  it("requires read access", async () => {
    const response = await getMonitoring(
      new NextRequest("http://localhost/api/monitoring"),
    );

    expect(response.status).toBe(401);
  });

  it("returns aggregate monitoring totals", async () => {
    const response = await getMonitoring(
      new NextRequest("http://localhost/api/monitoring", {
        headers: {
          authorization: "Bearer test-token",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      community: {
        totalReports: 1,
        activeServices: 1,
      },
      installedSignals: {
        totalSignals: 3,
        activeServices: 1,
        installationServiceObservations: 1,
      },
      clicks: {
        totalClicks: 2,
        activeMetrics: 1,
      },
    });
  });

  it("returns 503 when storage is unavailable", async () => {
    reportStorage.getSummary.mockRejectedValueOnce(new Error("down"));

    const response = await getMonitoring(
      new NextRequest("http://localhost/api/monitoring", {
        headers: {
          authorization: "Bearer test-token",
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "redis_unavailable",
    });
  });
});
