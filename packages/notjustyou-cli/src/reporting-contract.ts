// Supported persisted collector configuration; independent of dashboard visibility.
export const SIGNAL_SOURCES = new Set([
  "api_middleware",
  "cli_hook",
  "ide_extension",
  "browser_extension",
  "mcp_monitor",
  "local_probe",
]);
export const SERVICE_IDS = new Set([
  "anthropic-claude-code",
  "anthropic-claude-ai",
  "anthropic-claude-cowork",
  "anthropic-claude-api",
  "openai-codex-cli",
  "openai-codex-app",
  "openai-chatgpt",
  "openai-api",
  "google-antigravity-cli",
  "google-antigravity",
  "google-antigravity-ide",
  "google-gemini-web",
  "google-gemini-api",
  "cursor-ide",
  "cursor-cli",
]);
