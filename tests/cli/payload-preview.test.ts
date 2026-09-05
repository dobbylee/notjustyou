import { createTempDir } from "@/tests/helpers/temp-dir";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { scanForSensitiveKeys as scanServerPayload } from "@/lib/signals/privacy";
import { main } from "@/packages/notjustyou-cli/src/index";
import { normalizeLocalHookEvent } from "@/packages/notjustyou-cli/src/local-hook";
import { previewPayload, scanForSensitiveKeys } from "@/packages/notjustyou-cli/src/privacy";

describe("CLI payload preview", () => {
  it("accepts metadata-only fixtures and prints the sendable shape", async () => {
    const fixture = writeFixture({
      serviceId: "openai-api",
      source: "api_middleware",
      symptom: "rate_limited",
      durationMs: 1200,
      statusCode: 429,
      errorCode: "rate_limit_exceeded",
      installationId: "random-local-id",
      clientVersion: "0.1.0",
      regionHint: "us",
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(main(["payload-preview", "--fixture", fixture])).resolves.toBe(0);

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Metadata-only payload preview:");
    expect(output).toContain('"statusCode": 429');
    expect(output).not.toContain("authorization");
  });

  it("accepts hook fixtures and prints normalized metadata", async () => {
    const fixture = writeFixture({
      serviceId: "openai-codex-cli",
      surface: "codex-cli",
      eventName: "run.failed",
      symptom: "tool_failure",
      observedAt: "2026-06-21T00:00:00Z",
      durationMs: 1200,
      statusCode: 500,
      errorCode: "tool_failed",
      clientVersion: "0.3.0",
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(main(["payload-preview", "--fixture", fixture])).resolves.toBe(0);

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Normalized hook signal preview:");
    expect(output).toContain('"source": "cli_hook"');
    expect(output).toContain('"serviceId": "openai-codex-cli"');
    expect(output).not.toContain("run.failed");
    expect(output).not.toContain("surface");
  });

  it("accepts raw Cursor hook fixtures but prints only normalized metadata", async () => {
    const fixture = writeFixture({
      rawHook: "cursor",
      payload: {
        hook_event_name: "stop",
        status: "error",
        cursor_version: "1.7.2",
        user_email: "alice@example.com",
        workspace_roots: ["/Users/alice/private-project"],
        transcript_path: "/Users/alice/.cursor/transcript.json",
        prompt: "do not collect this prompt",
        output: "do not collect this output",
      },
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(main(["payload-preview", "--fixture", fixture])).resolves.toBe(0);

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Normalized hook signal preview:");
    expect(output).toContain('"serviceId": "cursor-ide"');
    expect(output).toContain('"source": "cli_hook"');
    expect(output).toContain('"errorCode": "cursor_agent_error"');
    expect(output).not.toContain("alice@example.com");
    expect(output).not.toContain("/Users/alice");
    expect(output).not.toContain("do not collect");
    expect(output).not.toContain("transcript");
  });

  it("rejects raw Codex hooks with a report-specific reason", () => {
    expect(
      previewPayload({
        rawHook: "codex",
        payload: {
          hook_event_name: "PostToolUse",
          tool_input: {
            command: "npm test",
          },
          tool_response: "failing output",
          transcript_path: "/Users/alice/.codex/transcript.json",
        },
      }),
    ).toEqual({
      ok: false,
      reason: "Codex raw hooks are not classified as service failure signals yet.",
    });
  });

  it("does not bypass sensitive scanning for malformed raw hook envelopes", () => {
    expect(
      previewPayload({
        rawHook: "cursor",
        payload: {
          hook_event_name: "stop",
          status: "error",
        },
        prompt: "top-level raw prompt",
      }),
    ).toEqual({
      ok: false,
      reason: "Sensitive field rejected: prompt",
    });
  });

  it("omits sensitive-looking optional metadata from raw Cursor hooks", () => {
    for (const cursorVersion of [
      "/Users/alice/.cursor",
      "/tmp/cursor-version",
      "/private/tmp/cursor-version",
      "C:\\temp\\cursor-version",
      "not-a-version",
    ]) {
      expect(
        previewPayload({
          rawHook: "cursor",
          payload: {
            hook_event_name: "stop",
            status: "error",
            cursor_version: cursorVersion,
          },
        }),
      ).toEqual({
        ok: true,
        kind: "hook",
        payload: {
          serviceId: "cursor-ide",
          source: "cli_hook",
          symptom: "error",
          errorCode: "cursor_agent_error",
        },
      });
    }
  });

  it("keeps version-shaped optional metadata from raw Cursor hooks", () => {
    expect(
      previewPayload({
        rawHook: "cursor",
        payload: {
          hook_event_name: "stop",
          status: "error",
          cursor_version: "1.7.2-beta.1",
        },
      }),
    ).toEqual({
      ok: true,
      kind: "hook",
      payload: {
        serviceId: "cursor-ide",
        source: "cli_hook",
        symptom: "error",
        errorCode: "cursor_agent_error",
        clientVersion: "1.7.2-beta.1",
      },
    });
  });

  it("normalizes only allowed hook fields", () => {
    expect(
      normalizeLocalHookEvent({
        serviceId: "anthropic-claude-code",
        surface: "claude-code",
        eventName: "session.failed",
        symptom: "error",
      }),
    ).toEqual({
      ok: true,
      payload: {
        serviceId: "anthropic-claude-code",
        source: "cli_hook",
        symptom: "error",
      },
    });

    expect(
      normalizeLocalHookEvent({
        serviceId: "anthropic-claude-code",
        surface: "claude-code",
        eventName: "session.failed",
        symptom: "error",
        source: "cli_hook",
      }),
    ).toEqual({
      ok: false,
      reason: "Unknown field rejected: source",
    });
  });

  it("requires hook serviceId to match the declared surface", () => {
    expect(
      normalizeLocalHookEvent({
        serviceId: "openai-codex-cli",
        surface: "claude-code",
        eventName: "session.failed",
        symptom: "error",
      }),
    ).toEqual({
      ok: false,
      reason: "serviceId does not match surface.",
    });
  });

  it("rejects sensitive values in allowed hook metadata fields", () => {
    for (const [field, value] of [
      ["errorCode", "alice@example.com"],
      ["errorCode", "Bearer secret-token"],
      ["clientVersion", "njy_secret"],
      ["eventName", "/Users/alice/project/run.failed"],
    ]) {
      expect(
        normalizeLocalHookEvent({
          serviceId: "openai-codex-cli",
          surface: "codex-cli",
          eventName: "run.failed",
          symptom: "error",
          [field]: value,
        }),
      ).toEqual({
        ok: false,
        reason: `Sensitive value rejected: ${field}`,
      });
    }
  });

  it("accepts UTC observedAt values accepted by the server schema", () => {
    expect(
      previewPayload({
        serviceId: "openai-api",
        source: "api_middleware",
        symptom: "error",
        observedAt: "2026-06-21T00:00Z",
      }),
    ).toMatchObject({
      ok: true,
    });
  });

  it("rejects sensitive fields recursively", () => {
    for (const key of [
      "prompt",
      "message",
      "commandArgs",
      "shellOutput",
      "toolInput",
      "toolResultBody",
      "filePath",
      "body",
      "headers",
      "token",
      "accountEmail",
      "machineName",
      "userName",
      "fileContent",
      "diff",
      "email",
    ]) {
      expect(previewPayload({ serviceId: "openai-api", nested: { [key]: "secret" } }))
        .toMatchObject({
          ok: false,
        });
    }
  });

  it("keeps CLI sensitive key scanning aligned with the server scanner", () => {
    const payload = {
      statusCode: 429,
      errorCode: "rate_limit_exceeded",
      nested: {
        code: "source code is not allowed",
      },
    };

    expect(scanForSensitiveKeys(payload)).toEqual(scanServerPayload(payload));
  });

  it("rejects unknown fields before showing a payload", () => {
    expect(
      previewPayload({
        serviceId: "openai-api",
        source: "api_middleware",
        symptom: "error",
        collectorId: "col_test",
      }),
    ).toEqual({
      ok: false,
      reason: "Unknown field rejected: collectorId",
    });
  });

  it("rejects metadata that the server signal schema would reject", () => {
    expect(
      previewPayload({
        serviceId: "missing-service",
        source: "api_middleware",
        symptom: "error",
      }),
    ).toEqual({
      ok: false,
      reason: "serviceId is unknown.",
    });
    expect(
      previewPayload({
        serviceId: "openai-api",
        source: "api_middleware",
        symptom: "error",
        statusCode: 0,
      }),
    ).toEqual({
      ok: false,
      reason: "statusCode must be an integer from 100 to 599.",
    });
    expect(
      previewPayload({
        serviceId: "openai-api",
        source: "api_middleware",
        symptom: "error",
        durationMs: 600_001,
      }),
    ).toEqual({
      ok: false,
      reason: "durationMs must be an integer from 0 to 600000.",
    });
    expect(
      previewPayload({
        serviceId: "openai-api",
        source: "api_middleware",
        symptom: "error",
        observedAt: "2026-06-21T00:00:00+09:00",
      }),
    ).toEqual({
      ok: false,
      reason: "observedAt must be an ISO timestamp.",
    });
    expect(
      previewPayload({
        serviceId: "openai-api",
        source: "api_middleware",
        symptom: "error",
        observedAt: "2026-02-31T00:00:00Z",
      }),
    ).toEqual({
      ok: false,
      reason: "observedAt must be an ISO timestamp.",
    });
  });
});

function writeFixture(body: unknown) {
  const path = join(createTempDir("njy-preview-test-"), "fixture.json");
  writeFileSync(path, JSON.stringify(body));
  return path;
}
