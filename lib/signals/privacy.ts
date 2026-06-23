const SENSITIVE_KEYS = new Set([
  "prompt",
  "message",
  "args",
  "commandargs",
  "shelloutput",
  "toolinput",
  "toolresult",
  "toolresultbody",
  "filepath",
  "body",
  "request",
  "response",
  "headers",
  "authorization",
  "cookie",
  "apikey",
  "token",
  "accountemail",
  "email",
  "machinename",
  "username",
  "user",
  "diff",
  "filecontent",
  "code",
]);

export const SIGNAL_BODY_LIMIT_BYTES = 8 * 1024;

export type SensitiveScanResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      key: string;
    };

export function scanForSensitiveKeys(input: unknown): SensitiveScanResult {
  return scanValue(input);
}

export function isBodyWithinSignalLimit(body: string) {
  return Buffer.byteLength(body, "utf8") <= SIGNAL_BODY_LIMIT_BYTES;
}

function scanValue(value: unknown): SensitiveScanResult {
  if (!value || typeof value !== "object") {
    return { ok: true };
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = scanValue(item);
      if (!result.ok) return result;
    }

    return { ok: true };
  }

  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      return {
        ok: false,
        key,
      };
    }

    const result = scanValue(child);
    if (!result.ok) return result;
  }

  return { ok: true };
}
