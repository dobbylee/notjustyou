import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const client = {
    isOpen: true,
    isReady: true,
    on: vi.fn(),
    connect: vi.fn(),
    ping: vi.fn(async () => "PONG"),
    eval: vi.fn(),
    hGetAll: vi.fn(async () => ({})),
    mGet: vi.fn(async (keys: string[]) => keys.map(() => null)),
    pfCount: vi.fn(async () => 0),
    sMembers: vi.fn(async () => []),
  };

  return {
    client,
    createClient: vi.fn<(options: { socket: { reconnectStrategy: (retries: number) => number | Error } }) => typeof client>(() => client),
  };
});

vi.mock("redis", () => ({
  createClient: mocks.createClient,
}));

describe("Redis connection recovery", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    mocks.client.connect
      .mockRejectedValueOnce(new Error("initial connection failure"))
      .mockResolvedValue(undefined);
    mocks.client.isOpen = true;
    mocks.client.isReady = true;
    mocks.client.eval.mockImplementation(
      async (_script: string, options: { keys: string[] }) =>
        options.keys.length === 2 ? [1, 180] : "200001010000",
    );
  });

  it("recovers health, report, and signal APIs in the same warm module graph", async () => {
    const { GET: getHealth } = await import("@/app/api/health/route");
    const { POST: postReport } = await import("@/app/api/report/route");
    const { GET: getSignalSummary } = await import(
      "@/app/api/signals/summary/route"
    );

    expect((await getHealth()).status).toBe(503);
    expect((await getHealth()).status).toBe(200);

    const reportResponse = await postReport(
      new NextRequest("http://localhost/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceId: "openai-api", status: "error" }),
      }),
    );
    const signalResponse = await getSignalSummary(
      new NextRequest("http://localhost/api/signals/summary"),
    );

    expect(reportResponse.status).toBe(200);
    expect(signalResponse.status).toBe(200);
    expect(mocks.createClient).toHaveBeenCalledTimes(2);
    expect(mocks.client.connect).toHaveBeenCalledTimes(2);
    expect(mocks.createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({
          connectTimeout: 3_000,
          reconnectStrategy: expect.any(Function),
        }),
      }),
    );
    const reconnectStrategy = mocks.createClient.mock.calls[0]?.[0]?.socket
      ?.reconnectStrategy as (retries: number) => number | Error;
    expect(reconnectStrategy(0)).toBe(50);
    expect(reconnectStrategy(2)).toBeInstanceOf(Error);

    mocks.client.isOpen = false;
    mocks.client.isReady = false;
    mocks.client.connect.mockImplementationOnce(async () => {
      mocks.client.isOpen = true;
      mocks.client.isReady = true;
    });
    expect((await getHealth()).status).toBe(200);
    expect(mocks.createClient).toHaveBeenCalledTimes(3);

    mocks.client.isOpen = false;
    mocks.client.isReady = false;
    mocks.client.connect.mockImplementationOnce(async () => {
      mocks.client.isOpen = true;
      mocks.client.isReady = true;
    });
    const [firstRecovery, secondRecovery] = await Promise.all([
      getHealth(),
      getHealth(),
    ]);
    expect(firstRecovery.status).toBe(200);
    expect(secondRecovery.status).toBe(200);
    expect(mocks.createClient).toHaveBeenCalledTimes(4);
  });
});
