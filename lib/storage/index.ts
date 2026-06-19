import { getRedis } from "../redis";
import { RedisReportStorage } from "./redis";
import { RedisSignalStorage } from "../signals/storage";
import type { ReportStorage } from "./types";

let storage: Promise<ReportStorage> | undefined;
let signalStorage: Promise<RedisSignalStorage> | undefined;

export function getReportStorage() {
  if (storage) return storage;

  storage = getRedis().then((redis) => new RedisReportStorage(redis));
  return storage;
}

export function getSignalStorage() {
  if (signalStorage) return signalStorage;

  signalStorage = getRedis().then((redis) => new RedisSignalStorage(redis));
  return signalStorage;
}
