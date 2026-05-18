import { describe, expect, it } from "vitest";
import {
  getClickCountKey,
  getClickHourBucket,
  getClickMetricSpecs,
  getRecentClickHourBuckets,
  validateClickEvent,
} from "@/lib/clicks";

describe("click analytics", () => {
  it("validates report button click events", () => {
    expect(
      validateClickEvent({
        event: "report_button",
        serviceId: "anthropic-claude-code",
        status: "slow",
      }),
    ).toEqual({
      ok: true,
      metricId: "report_button:anthropic-claude-code:slow",
    });
  });

  it("rejects unsupported report button dimensions", () => {
    expect(
      validateClickEvent({
        event: "report_button",
        serviceId: "missing",
        status: "slow",
      }),
    ).toEqual({
      ok: false,
      reason: "invalid_service",
    });

    expect(
      validateClickEvent({
        event: "report_button",
        serviceId: "anthropic-claude-code",
        status: "other",
      }),
    ).toEqual({
      ok: false,
      reason: "invalid_status",
    });
  });

  it("builds hourly Redis keys for the click summary window", () => {
    const now = new Date("2026-05-08T09:24:31.000Z");

    expect(getClickHourBucket(now)).toBe("2026050809");
    expect(getRecentClickHourBuckets(3, now)).toEqual([
      "2026050809",
      "2026050808",
      "2026050807",
    ]);
    expect(getClickCountKey("copy_link", "2026050809")).toBe(
      "click:v1:copy_link:2026050809",
    );
  });

  it("includes all tracked button metrics", () => {
    expect(getClickMetricSpecs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "report_button:anthropic-claude-code:slow",
          event: "report_button",
        }),
        expect.objectContaining({
          id: "provider_tab:anthropic",
          event: "provider_tab",
        }),
        expect.objectContaining({
          id: "refresh_button",
          event: "refresh_button",
        }),
        expect.objectContaining({
          id: "copy_link",
          event: "copy_link",
        }),
      ]),
    );
  });
});
