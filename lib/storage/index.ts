import { getRedis } from "../redis";
import { RedisReportStorage } from "./redis";
import type { ReportStorage } from "./types";

let storage: Promise<ReportStorage> | undefined;

export function getReportStorage() {
  if (storage) return storage;

  storage = getRedis().then((redis) => new RedisReportStorage(redis));
  return storage;
}
