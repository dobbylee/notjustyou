import { describe, expect, it } from "vitest";
import {
  createCollectorRecord,
  getInstallationLookupKey,
  getTokenLookupKey,
} from "@/lib/signals/collectors";

describe("collector helpers", () => {
  it("generates one-time tokens and stable HMAC lookup keys", () => {
    const collector = createCollectorRecord({
      source: "api_middleware",
      serviceIds: ["openai-api"],
      clientName: "notjustyou-sdk-js",
      clientVersion: "0.1.0",
    });
    const secret = "test-secret";

    expect(collector.collectorId).toMatch(/^col_/);
    expect(collector.collectorToken).toMatch(/^njy_/);
    expect(getTokenLookupKey(collector.collectorToken, secret)).toBe(
      getTokenLookupKey(collector.collectorToken, secret),
    );
    expect(getTokenLookupKey(collector.collectorToken, secret)).not.toContain(
      collector.collectorToken,
    );
  });

  it("hashes installation ids with collector scope", () => {
    const secret = "test-secret";

    expect(getInstallationLookupKey("col_a", "install_1", secret)).toBe(
      getInstallationLookupKey("col_a", "install_1", secret),
    );
    expect(getInstallationLookupKey("col_a", "install_1", secret)).not.toContain(
      "install_1",
    );
    expect(getInstallationLookupKey("col_a", "install_1", secret)).not.toBe(
      getInstallationLookupKey("col_b", "install_1", secret),
    );
  });
});

