import { fetchStatuspageProvider } from "./statuspage";

export function fetchCursorStatus() {
  return fetchStatuspageProvider(
    "cursor",
    "https://status.cursor.com/api/v2/summary.json",
  );
}
