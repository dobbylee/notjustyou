import { getRedis } from "../redis";
import { MemoryReportStorage } from "./memory";
import { RedisReportStorage } from "./redis";
import type { ReportStorage } from "./types";

let storage: ReportStorage | undefined;

export function getReportStorage() {
  if (storage) return storage;

  const redis = getRedis();
  storage = redis ? new RedisReportStorage(redis) : new MemoryReportStorage();

  return storage;
}
