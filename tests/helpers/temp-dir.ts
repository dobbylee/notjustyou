import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestFinished } from "vitest";

export function createTempDir(prefix: string) {
  const path = mkdtempSync(join(tmpdir(), prefix));
  onTestFinished(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
