import { describe, expect, it } from "vitest";
import { parseCliArgs } from "@/packages/notjustyou-cli/src/index";

describe("parseCliArgs", () => {
  it("treats help as help even after the status command", () => {
    expect(parseCliArgs(["status", "--help"])).toMatchObject({
      command: "help",
    });
    expect(parseCliArgs(["status", "-h"])).toMatchObject({
      command: "help",
    });
  });
});

