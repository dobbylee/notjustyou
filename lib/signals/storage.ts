import { CATALOG } from "../catalog";
import type { RedisClient } from "../redis";
import {
  getInstallationLookupKey,
  getTokenLookupKey,
  type CollectorRecord,
  type RegisteredCollector,
} from "./collectors";
import {
  emptyCountsBySource,
  emptyCountsBySymptom,
  getRecentSignalMinuteBuckets,
  getSignalCountKey,
  getSignalInstallationsKey,
  getSignalLastKey,
  HEARTBEAT_TTL_SECONDS,
  RATE_LIMIT_TTL_SECONDS,
  SIGNAL_COUNTER_TTL_SECONDS,
  SIGNAL_LAST_TTL_SECONDS,
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
    const countKey = getSignalCountKey(
      input.signal.serviceId,
      input.signal.source,
      input.signal.symptom,
      bucket,
    );

    await this.redis.incr(countKey);
    await this.redis.expire(countKey, SIGNAL_COUNTER_TTL_SECONDS);

    if (input.signal.installationId) {
      const installationHash = getInstallationLookupKey(
        input.signal.collectorId,
        input.signal.installationId,
        input.secret,
      );
      const installationsKey = getSignalInstallationsKey(input.signal.serviceId, bucket);
      await this.redis.sAdd(installationsKey, installationHash);
      await this.redis.expire(installationsKey, SIGNAL_COUNTER_TTL_SECONDS);
    }

    await this.redis.hSet(getSignalLastKey(input.signal.serviceId), {
      symptom: input.signal.symptom,
      source: input.signal.source,
      observedAt: input.signal.observedAt,
    });
    await this.redis.expire(
      getSignalLastKey(input.signal.serviceId),
      SIGNAL_LAST_TTL_SECONDS,
    );
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
    const countSpecs = services.flatMap((service) =>
      SIGNAL_SOURCES.flatMap((source) =>
        SIGNAL_SYMPTOMS.flatMap((symptom) =>
          buckets.map((bucket) => ({
            serviceId: service.id,
            source,
            symptom,
            key: getSignalCountKey(service.id, source, symptom, bucket),
          })),
        ),
      ),
    );
    const installationSpecs = services.flatMap((service) =>
      buckets.map((bucket) => ({
        serviceId: service.id,
        key: getSignalInstallationsKey(service.id, bucket),
      })),
    );
    const countValues = await this.redis.mGet(countSpecs.map((spec) => spec.key));
    const installationMembers = await Promise.all(
      installationSpecs.map((spec) => this.redis.sMembers(spec.key)),
    );
    const lastValues = await Promise.all(
      services.map((service) => this.redis.hGetAll(getSignalLastKey(service.id))),
    );
    type MutableSignalSummary = SignalServiceSummary & {
      uniqueInstallationHashes: Set<string>;
    };
    const summaries = new Map<string, MutableSignalSummary>(
      services.map((service) => [
        service.id,
        {
          serviceId: service.id,
          countsBySource: emptyCountsBySource(),
          countsBySymptom: emptyCountsBySymptom(),
          total: 0,
          uniqueInstallationsApprox: 0,
          uniqueInstallationHashes: new Set<string>(),
          lastSignal: null,
        },
      ]),
    );

    countSpecs.forEach((spec, index) => {
      const value = Number(countValues[index] ?? 0);
      const summary = summaries.get(spec.serviceId);
      if (!summary) return;

      summary.countsBySource[spec.source] += value;
      summary.countsBySymptom[spec.symptom] += value;
      summary.total += value;
    });

    installationSpecs.forEach((spec, index) => {
      const summary = summaries.get(spec.serviceId);
      if (!summary) return;

      for (const installationHash of installationMembers[index] ?? []) {
        summary.uniqueInstallationHashes.add(installationHash);
      }
    });

    services.forEach((service, index) => {
      const summary = summaries.get(service.id);
      const lastSignal = deserializeLastSignal(lastValues[index]);
      if (!summary || !lastSignal) return;

      summary.lastSignal = lastSignal;
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
          uniqueInstallationsApprox: summary.uniqueInstallationHashes.size,
          lastSignal: summary.lastSignal,
        };
      }),
    };
  }
}

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
