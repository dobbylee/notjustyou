import { createTempDir } from "@/tests/helpers/temp-dir";
import { describe, expect, it } from "vitest";
import { symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isDirectRun, parseCliArgs } from "@/packages/notjustyou-cli/src/index";

describe("parseCliArgs", () => {
  it("treats help as help even after the status command", () => {
    expect(parseCliArgs(["status", "--help"])).toMatchObject({
      command: "help",
    });
    expect(parseCliArgs(["status", "-h"])).toMatchObject({
      command: "help",
    });
  });

  it("recognizes npm bin symlinks as direct runs", () => {
    const target = join(createTempDir("njy-cli-test-"), "index.js");
    const link = join(createTempDir("njy-cli-bin-test-"), "njy");

    writeFileSync(target, "");
    symlinkSync(target, link);

    expect(isDirectRun(pathToFileURL(target).href, link)).toBe(true);
  });

  it("does not throw when an importing process has a missing argv path", () => {
    const target = join(createTempDir("njy-cli-test-"), "index.js");

    writeFileSync(target, "");

    expect(isDirectRun(pathToFileURL(target).href, "not-a-file")).toBe(false);
  });
});
