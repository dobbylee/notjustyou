import { createTempDir } from "@/tests/helpers/temp-dir";
import { statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getConfigPath,
  readConfig,
  writeConfig,
} from "@/packages/notjustyou-cli/src/config";

describe("CLI config", () => {
  it("reads and writes the local collector config with private file permissions", () => {
    const path = join(createTempDir("njy-config-test-"), "config.json");

    writeConfig(
      {
        baseUrl: "http://localhost:3000",
        collectorId: "col_test",
        collectorToken: "njy_secret",
        source: "api_middleware",
        serviceIds: ["openai-api"],
        clientName: "notjustyou-cli",
        clientVersion: "0.1.0",
      },
      path,
    );

    expect(readConfig(path)).toMatchObject({
      configVersion: 1,
      baseUrl: "http://localhost:3000",
      collectorToken: "njy_secret",
      source: "api_middleware",
      serviceIds: ["openai-api"],
    });
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("uses XDG_CONFIG_HOME unless an explicit config path is set", () => {
    expect(
      getConfigPath({
        NODE_ENV: "test",
        XDG_CONFIG_HOME: "/tmp/config-home",
      }),
    ).toBe("/tmp/config-home/notjustyou/config.json");
    expect(
      getConfigPath({
        NOTJUSTYOU_CONFIG_PATH: "/tmp/njy.json",
        NODE_ENV: "test",
        XDG_CONFIG_HOME: "/tmp/config-home",
      }),
    ).toBe("/tmp/njy.json");
  });

  it("rejects unsupported source and unknown service ids", () => {
    const path = join(createTempDir("njy-config-test-"), "config.json");

    writeFileSync(
      path,
      JSON.stringify({
        configVersion: 1,
        baseUrl: "https://notjustyou.dev",
        collectorId: "col_test",
        collectorToken: "njy_secret",
        source: "manual_report",
        serviceIds: ["openai-api"],
        clientName: "notjustyou-cli",
        clientVersion: "0.1.0",
      }),
    );
    expect(() => readConfig(path)).toThrow("source is unsupported");

    writeFileSync(
      path,
      JSON.stringify({
        configVersion: 1,
        baseUrl: "https://notjustyou.dev",
        collectorId: "col_test",
        collectorToken: "njy_secret",
        source: "api_middleware",
        serviceIds: ["missing-service"],
        clientName: "notjustyou-cli",
        clientVersion: "0.1.0",
      }),
    );
    expect(() => readConfig(path)).toThrow("unknown service");
  });
});
