import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRedis: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  getRedis: mocks.getRedis,
}));

describe("storage initialization recovery", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getRedis.mockReset();
  });

  it("retries report storage after an initialization rejection", async () => {
    const redis = {};
    mocks.getRedis.mockRejectedValueOnce(new Error("initial failure"));
    mocks.getRedis.mockResolvedValueOnce(redis);
    const { getReportStorage } = await import("@/lib/storage");

    await expect(getReportStorage()).rejects.toThrow("initial failure");
    await expect(getReportStorage()).resolves.toBeDefined();
    expect(mocks.getRedis).toHaveBeenCalledTimes(2);
  });

  it("retries signal storage after an initialization rejection", async () => {
    const redis = {};
    mocks.getRedis.mockRejectedValueOnce(new Error("initial failure"));
    mocks.getRedis.mockResolvedValueOnce(redis);
    const { getSignalStorage } = await import("@/lib/storage");

    await expect(getSignalStorage()).rejects.toThrow("initial failure");
    await expect(getSignalStorage()).resolves.toBeDefined();
    expect(mocks.getRedis).toHaveBeenCalledTimes(2);
  });
});
