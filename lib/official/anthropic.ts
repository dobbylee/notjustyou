import { fetchStatuspageProvider } from "./statuspage";

export function fetchAnthropicStatus() {
  return fetchStatuspageProvider(
    "anthropic",
    "https://status.claude.com/api/v2/summary.json",
  );
}
