import { fetchStatuspageProvider } from "./statuspage";

export function fetchAnthropicStatus() {
  return fetchStatuspageProvider("anthropic", "https://status.anthropic.com/api/v2/summary.json");
}
