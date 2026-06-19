import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { CollectorRegistrationInput, SignalSource } from "./schema";

export interface CollectorRecord {
  collectorId: string;
  source: SignalSource;
  serviceIds: string[];
  clientName: string;
  clientVersion: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface RegisteredCollector extends CollectorRecord {
  collectorToken: string;
}

export function createCollectorRecord(
  input: CollectorRegistrationInput,
  now = new Date(),
): RegisteredCollector {
  return {
    collectorId: `col_${randomUUID().replaceAll("-", "")}`,
    collectorToken: `njy_${randomBytes(32).toString("base64url")}`,
    source: input.source,
    serviceIds: [...new Set(input.serviceIds)].sort(),
    clientName: input.clientName,
    clientVersion: input.clientVersion,
    createdAt: now.toISOString(),
    revokedAt: null,
  };
}

export function getTokenLookupKey(token: string, secret: string) {
  return hmacValue(token, secret);
}

export function getInstallationLookupKey(
  collectorId: string,
  installationId: string,
  secret: string,
) {
  return hmacValue(`${collectorId}:${installationId}`, secret);
}

export function getSignalSecret() {
  const secret = process.env.NOTJUSTYOU_SIGNAL_SECRET?.trim();

  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("NOTJUSTYOU_SIGNAL_SECRET is required in production.");
  }

  return "notjustyou-local-development-signal-secret";
}

function hmacValue(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

