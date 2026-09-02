import { describe, expect, it } from "vitest";
import {
  GET,
  OPENAI_APPS_CHALLENGE_TOKEN,
} from "@/app/.well-known/openai-apps-challenge/route";

describe("OpenAI Apps domain challenge route", () => {
  it("returns the exact challenge token as plain text", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    await expect(response.text()).resolves.toBe(OPENAI_APPS_CHALLENGE_TOKEN);
  });
});
