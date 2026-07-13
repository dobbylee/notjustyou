import { CATALOG } from "../catalog";
import type { RedisClient } from "../redis";
import {
  getInstallationLookupKey,
  getSignalDedupeLookupKey,
  getTokenLookupKey,
  type CollectorRecord,
  type RegisteredCollector,
} from "./collectors";
import {
  emptyCountsBySource,
  emptyCountsBySymptom,
  getRecentSignalMinuteBuckets,
  getSignalBucketKey,
  getSignalCountKey,
  getSignalInstallationsKey,
  getSignalInstallationsV2Key,
  getSignalLastKey,
  getSignalMinuteBucket,
  HEARTBEAT_TTL_SECONDS,
  RATE_LIMIT_TTL_SECONDS,
  SIGNAL_COUNTER_TTL_SECONDS,
  SIGNAL_DEDUPE_TTL_SECONDS,
  SIGNAL_LAST_TTL_SECONDS,
  SIGNAL_V2_CUTOVER_KEY,
  SIGNAL_V2_LEGACY_OVERLAP_MINUTES,
  type SignalServiceSummary,
  type SignalSummaryResponse,
} from "./aggregation";
import { evaluateRateLimit, SIGNAL_RATE_LIMITS } from "./rate-limit";
import {
  SIGNAL_SOURCES,
  SIGNAL_SYMPTOMS,
  type SignalSource,
  type SignalSymptom,
  type StoredProblemSignal,
} from "./schema";

export interface RecordSignalInput {
  signal: StoredProblemSignal;
  token: string;
  secret: string;
}

export class RedisSignalStorage {
  constructor(private readonly redis: RedisClient) {}

  async registerCollector(collector: RegisteredCollector, secret: string) {
    const tokenLookupKey = getTokenLookupKey(collector.collectorToken, secret);
    const stored = serializeCollector(collector);

    await this.redis.hSet(getCollectorIdKey(collector.collectorId), stored);
    await this.redis.hSet(getCollectorTokenKey(tokenLookupKey), stored);
  }

  async findCollectorByToken(token: string, secret: string) {
    const tokenLookupKey = getTokenLookupKey(token, secret);
    const raw = await this.redis.hGetAll(getCollectorTokenKey(tokenLookupKey));

    return deserializeCollector(raw);
  }

  async recordHeartbeat(input: {
    collectorId: string;
    installationId: string;
    clientVersion: string;
    secret: string;
  }) {
    const installationHash = getInstallationLookupKey(
      input.collectorId,
      input.installationId,
      input.secret,
    );
    const key = `collector:v1:heartbeat:${input.collectorId}:${installationHash}`;

    await this.redis.hSet(key, {
      collectorId: input.collectorId,
      installationHash,
      clientVersion: input.clientVersion,
      seenAt: new Date().toISOString(),
    });
    await this.redis.expire(key, HEARTBEAT_TTL_SECONDS);
  }

  async checkHeartbeatRateLimits(input: {
    collectorId: string;
    installationId: string;
    secret: string;
    now?: Date;
  }) {
    const bucket = minuteBucket(input.now ?? new Date());
    const collectorKey = `collector:v1:rate:heartbeat:${input.collectorId}:${bucket}`;
    const collectorCount = await this.redis.incr(collectorKey);
    await this.redis.expire(collectorKey, RATE_LIMIT_TTL_SECONDS);
    const collectorLimit = evaluateRateLimit(
      collectorCount,
      SIGNAL_RATE_LIMITS.heartbeatCollectorPerMinute,
    );

    if (!collectorLimit.allowed) return collectorLimit;

    const installationHash = getInstallationLookupKey(
      input.collectorId,
      input.installationId,
      input.secret,
    );
    const installationKey = `collector:v1:rate:heartbeat-installation:${installationHash}:${bucket}`;
    const installationCount = await this.redis.incr(installationKey);
    await this.redis.expire(installationKey, RATE_LIMIT_TTL_SECONDS);

    return evaluateRateLimit(
      installationCount,
      SIGNAL_RATE_LIMITS.heartbeatInstallationPerMinute,
    );
  }

  async checkRegistrationRateLimit(fingerprint: string, now = new Date()) {
    const key = `collector:v1:rate:register:${fingerprint}:${minuteBucket(now)}`;
    const count = await this.redis.incr(key);
    await this.redis.expire(key, RATE_LIMIT_TTL_SECONDS);

    return evaluateRateLimit(count, SIGNAL_RATE_LIMITS.registrationPerMinute);
  }

  async recordSignal(input: RecordSignalInput) {
    const bucket = minuteBucket(new Date(input.signal.receivedAt));
    const installationHash = input.signal.installationId
      ? getInstallationLookupKey(
        input.signal.collectorId,
        input.signal.installationId,
        input.secret,
      )
      : "";
    const signalDedupeKey = input.signal.signalId
      ? `signal:v2:dedupe:${getSignalDedupeLookupKey(
          input.signal.collectorId,
          input.signal.signalId,
          input.secret,
        )}`
      : "signal:v2:dedupe:legacy";
    const result = await this.redis.eval(RECORD_SIGNAL_SCRIPT, {
      keys: [
        signalDedupeKey,
        getSignalBucketKey(bucket),
        getSignalInstallationsV2Key(input.signal.serviceId, bucket),
        getSignalLastKey(input.signal.serviceId),
        SIGNAL_V2_CUTOVER_KEY,
      ],
      arguments: [
        input.signal.signalId ? "1" : "0",
        String(SIGNAL_DEDUPE_TTL_SECONDS),
        `total:${input.signal.serviceId}`,
        `source:${input.signal.serviceId}:${input.signal.source}`,
        `symptom:${input.signal.serviceId}:${input.signal.symptom}`,
        String(SIGNAL_COUNTER_TTL_SECONDS),
        installationHash,
        input.signal.symptom,
        input.signal.source,
        input.signal.observedAt,
        String(SIGNAL_LAST_TTL_SECONDS),
        bucket,
      ],
    });

    return {
      counted: Number(result) === 1,
    };
  }

  async checkSignalRateLimits(input: {
    collectorId: string;
    serviceId: string;
    installationId?: string;
    secret: string;
    now?: Date;
  }) {
    const bucket = minuteBucket(input.now ?? new Date());
    const collectorCount = await this.redis.incr(
      `collector:v1:rate:token:${input.collectorId}:${bucket}`,
    );
    await this.redis.expire(
      `collector:v1:rate:token:${input.collectorId}:${bucket}`,
      RATE_LIMIT_TTL_SECONDS,
    );

    const collectorLimit = evaluateRateLimit(
      collectorCount,
      SIGNAL_RATE_LIMITS.collectorPerMinute,
    );
    if (!collectorLimit.allowed) return collectorLimit;

    if (input.installationId) {
      const installationHash = getInstallationLookupKey(
        input.collectorId,
        input.installationId,
        input.secret,
      );
      const key = `collector:v1:rate:installation:${installationHash}:${bucket}`;
      const installationCount = await this.redis.incr(key);
      await this.redis.expire(key, RATE_LIMIT_TTL_SECONDS);
      const installationLimit = evaluateRateLimit(
        installationCount,
        SIGNAL_RATE_LIMITS.installationPerMinute,
      );

      if (!installationLimit.allowed) return installationLimit;
    }

    const serviceKey = `collector:v1:rate:service:${input.serviceId}:${bucket}`;
    const serviceCount = await this.redis.incr(serviceKey);
    await this.redis.expire(serviceKey, RATE_LIMIT_TTL_SECONDS);
    const serviceSoftLimit = evaluateRateLimit(
      serviceCount,
      SIGNAL_RATE_LIMITS.serviceSoftPerMinute,
    );

    return {
      allowed: true,
      retryAfterSeconds: 60,
      serviceSoftLimited: !serviceSoftLimit.allowed,
    };
  }

  async getSignalSummary(input: {
    windowMinutes: number;
    now?: Date;
    serviceId?: string;
  }): Promise<SignalSummaryResponse> {
    const now = input.now ?? new Date();
    const buckets = getRecentSignalMinuteBuckets(input.windowMinutes, now);
    const services = CATALOG.filter(
      (service) => !input.serviceId || service.id === input.serviceId,
    );
    const cutoverBucket = String(
      await this.redis.eval(READ_SIGNAL_CUTOVER_SCRIPT, {
        keys: [SIGNAL_V2_CUTOVER_KEY],
        arguments: [getSignalMinuteBucket(now)],
      }),
    );
    const legacyReadThroughBucket = addMinutesToBucket(
      cutoverBucket,
      SIGNAL_V2_LEGACY_OVERLAP_MINUTES,
    );
    const legacyBuckets = buckets.filter(
      (bucket) => bucket <= legacyReadThroughBucket,
    );
    const legacyCountSpecs = services.flatMap((service) =>
      SIGNAL_SOURCES.flatMap((source) =>
        SIGNAL_SYMPTOMS.flatMap((symptom) =>
          legacyBuckets.map((bucket) => ({
            serviceId: service.id,
            source,
            symptom,
            key: getSignalCountKey(service.id, source, symptom, bucket),
          })),
        ),
      ),
    );
    const legacyInstallationSpecs = services.flatMap((service) =>
      legacyBuckets.map((bucket) => ({
        serviceId: service.id,
        key: getSignalInstallationsKey(service.id, bucket),
      })),
    );
    const [
      bucketValues,
      installationCounts,
      lastValues,
      legacyCountValues,
      legacyInstallationMembers,
    ] = await Promise.all([
      Promise.all(buckets.map((bucket) => this.redis.hGetAll(getSignalBucketKey(bucket)))),
      input.serviceId
        ? Promise.all(
            services.map((service) =>
              this.redis.pfCount(
                buckets.map((bucket) =>
                  getSignalInstallationsV2Key(service.id, bucket),
                ),
              ),
            ),
          )
        : Promise.resolve(services.map(() => 0)),
      Promise.all(
        services.map((service) => this.redis.hGetAll(getSignalLastKey(service.id))),
      ),
      legacyCountSpecs.length > 0
        ? this.redis.mGet(legacyCountSpecs.map((spec) => spec.key))
        : Promise.resolve([]),
      input.serviceId
        ? Promise.all(
            legacyInstallationSpecs.map((spec) => this.redis.sMembers(spec.key)),
          )
        : Promise.resolve(legacyInstallationSpecs.map(() => [] as string[])),
    ]);
    const legacyInstallationsByService = new Map(
      services.map((service) => [service.id, new Set<string>()]),
    );
    const summaries = new Map<string, SignalServiceSummary>(
      services.map((service) => [
        service.id,
        {
          serviceId: service.id,
          countsBySource: emptyCountsBySource(),
          countsBySymptom: emptyCountsBySymptom(),
          total: 0,
          uniqueInstallationsApprox: 0,
          lastSignal: null,
        },
      ]),
    );

    for (const bucketValue of bucketValues) {
      for (const service of services) {
        const summary = summaries.get(service.id)!;
        summary.total += Number(bucketValue[`total:${service.id}`] ?? 0);

        for (const source of SIGNAL_SOURCES) {
          summary.countsBySource[source] += Number(
            bucketValue[`source:${service.id}:${source}`] ?? 0,
          );
        }
        for (const symptom of SIGNAL_SYMPTOMS) {
          summary.countsBySymptom[symptom] += Number(
            bucketValue[`symptom:${service.id}:${symptom}`] ?? 0,
          );
        }
      }
    }

    legacyCountSpecs.forEach((spec, index) => {
      const value = Number(legacyCountValues[index] ?? 0);
      const summary = summaries.get(spec.serviceId);
      if (!summary) return;

      summary.countsBySource[spec.source] += value;
      summary.countsBySymptom[spec.symptom] += value;
      summary.total += value;
    });

    legacyInstallationSpecs.forEach((spec, index) => {
      const hashes = legacyInstallationsByService.get(spec.serviceId);
      if (!hashes) return;
      for (const hash of legacyInstallationMembers[index] ?? []) hashes.add(hash);
    });

    services.forEach((service, index) => {
      const summary = summaries.get(service.id);
      const lastSignal = deserializeLastSignal(lastValues[index]);
      if (!summary) return;

      summary.uniqueInstallationsApprox =
        Number(installationCounts[index] ?? 0) +
        (legacyInstallationsByService.get(service.id)?.size ?? 0);
      if (lastSignal) summary.lastSignal = lastSignal;
    });

    return {
      windowMinutes: input.windowMinutes,
      updatedAt: now.toISOString(),
      services: services.map((service) => {
        const summary = summaries.get(service.id)!;

        return {
          serviceId: summary.serviceId,
          countsBySource: summary.countsBySource,
          countsBySymptom: summary.countsBySymptom,
          total: summary.total,
          uniqueInstallationsApprox: summary.uniqueInstallationsApprox,
          lastSignal: summary.lastSignal,
        };
      }),
    };
  }
}

export const RECORD_SIGNAL_SCRIPT = `
local bucketType = redis.call("TYPE", KEYS[2]).ok
if bucketType ~= "none" and bucketType ~= "hash" then
  return redis.error_reply("signal counter bucket has an invalid Redis type")
end
local function incrementableCounter(field)
  local value = redis.call("HGET", KEYS[2], field)
  if not value then return true end
  local negative = string.match(value, "^%-[1-9]%d*$") ~= nil
  local positive = value == "0" or string.match(value, "^[1-9]%d*$") ~= nil
  if not negative and not positive then return false end
  local digits = negative and string.sub(value, 2) or value
  local normalized = string.gsub(digits, "^0+", "")
  if normalized == "" then normalized = "0" end
  if string.len(normalized) < 19 then return true end
  if string.len(normalized) > 19 then return false end
  if negative then return normalized <= "9223372036854775808" end
  return normalized < "9223372036854775807"
end
if not incrementableCounter(ARGV[3]) or not incrementableCounter(ARGV[4]) or not incrementableCounter(ARGV[5]) then
  return redis.error_reply("signal counter field cannot be incremented")
end
local lastType = redis.call("TYPE", KEYS[4]).ok
if lastType ~= "none" and lastType ~= "hash" then
  return redis.error_reply("last signal has an invalid Redis type")
end
if ARGV[7] ~= "" and redis.call("EXISTS", KEYS[3]) == 1 then
  local installationCheck = redis.pcall("PFCOUNT", KEYS[3])
  if type(installationCheck) == "table" and installationCheck.err then
    return redis.error_reply("signal installation counter is invalid")
  end
end
if ARGV[1] == "1" and redis.call("EXISTS", KEYS[1]) == 1 then
  return 0
end
if redis.call("EXISTS", KEYS[5]) == 0 then
  redis.call("SET", KEYS[5], ARGV[12])
end
redis.call("HINCRBY", KEYS[2], ARGV[3], 1)
redis.call("HINCRBY", KEYS[2], ARGV[4], 1)
redis.call("HINCRBY", KEYS[2], ARGV[5], 1)
redis.call("EXPIRE", KEYS[2], ARGV[6])
if ARGV[7] ~= "" then
  redis.call("PFADD", KEYS[3], ARGV[7])
  redis.call("EXPIRE", KEYS[3], ARGV[6])
end
redis.call("HSET", KEYS[4], "symptom", ARGV[8], "source", ARGV[9], "observedAt", ARGV[10])
redis.call("EXPIRE", KEYS[4], ARGV[11])
if ARGV[1] == "1" then
  redis.call("SET", KEYS[1], "1", "EX", ARGV[2])
end
return 1
`;

const READ_SIGNAL_CUTOVER_SCRIPT = `
local cutover = redis.call("GET", KEYS[1])
if not cutover then
  cutover = ARGV[1]
  redis.call("SET", KEYS[1], cutover)
end
return cutover
`;

function getCollectorIdKey(collectorId: string) {
  return `collector:v1:id:${collectorId}`;
}

function getCollectorTokenKey(tokenLookupKey: string) {
  return `collector:v1:token:${tokenLookupKey}`;
}

function serializeCollector(collector: CollectorRecord) {
  return {
    collectorId: collector.collectorId,
    source: collector.source,
    serviceIds: JSON.stringify(collector.serviceIds),
    clientName: collector.clientName,
    clientVersion: collector.clientVersion,
    createdAt: collector.createdAt,
    revokedAt: collector.revokedAt ?? "",
  };
}

function deserializeCollector(raw: Record<string, string>): CollectorRecord | null {
  if (!raw.collectorId || !raw.source || !raw.serviceIds) return null;

  return {
    collectorId: raw.collectorId,
    source: raw.source as SignalSource,
    serviceIds: JSON.parse(raw.serviceIds) as string[],
    clientName: raw.clientName ?? "",
    clientVersion: raw.clientVersion ?? "",
    createdAt: raw.createdAt ?? "",
    revokedAt: raw.revokedAt || null,
  };
}

function deserializeLastSignal(raw: Record<string, string> | undefined) {
  if (!raw?.symptom || !raw.source || !raw.observedAt) return null;

  return {
    symptom: raw.symptom as SignalSymptom,
    source: raw.source as SignalSource,
    observedAt: raw.observedAt,
  };
}

function minuteBucket(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");

  return `${year}${month}${day}${hour}${minute}`;
}

function addMinutesToBucket(bucket: string, minutes: number) {
  const date = new Date(
    Date.UTC(
      Number(bucket.slice(0, 4)),
      Number(bucket.slice(4, 6)) - 1,
      Number(bucket.slice(6, 8)),
      Number(bucket.slice(8, 10)),
      Number(bucket.slice(10, 12)) + minutes,
    ),
  );

  return minuteBucket(date);
}
