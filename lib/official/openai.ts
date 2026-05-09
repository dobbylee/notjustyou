import { fetchStatuspageProvider } from "./statuspage";

export function fetchOpenAIStatus() {
  return fetchStatuspageProvider(
    "openai",
    "https://status.openai.com/api/v2/summary.json",
  );
}
