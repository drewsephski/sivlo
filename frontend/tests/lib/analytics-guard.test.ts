import { describe, expect, test } from "bun:test";
import {
  ALLOWED_ANALYTICS_PROPERTY_KEYS,
  isAllowedAnalyticsPropertyKey,
  resolveAnalyticsConsent,
  sanitizeAnalyticsProperties,
} from "../../src/features/analytics/guard";

describe("sanitizeAnalyticsProperties", () => {
  test("drops content keys and non-allowlisted payloads", () => {
    const sanitized = sanitizeAnalyticsProperties({
      meeting_id: "m-1",
      transcript: "confidential meeting text",
      title: "Q3 planning",
      summary: "secret summary",
      notes: "private notes",
      prompt: "summarize this",
      response: "ai output",
      content: "some content",
      meeting_content: "more content",
      audio_path: "/tmp/recording.wav",
      file_path: "/tmp/meeting.wav",
      path: "/tmp/notes.txt",
      meeting_name: "Q3 planning",
      device_name: "Built-in Microphone",
      user_agent: "Mozilla/5.0 ...",
      page: "home",
      button: "record",
      location: "/some/path",
      error: "connection refused",
      user_id: "user-123",
      first_seen: "2026-01-01T00:00:00Z",
      platform: "macOS",
      os_version: "macOS 15 (user agent)",
      architecture: "aarch64",
    });

    expect(sanitized).toEqual({ meeting_id: "m-1" });
  });

  test("keeps allowlisted operational keys", () => {
    const sanitized = sanitizeAnalyticsProperties({
      session_id: "s-1",
      session_duration_seconds: "120",
      timestamp: "2026-01-01T00:00:00Z",
      app_version: "0.4.0",
      app_platform: "macOS",
      app_os_version: "26.1",
      app_arch: "aarch64",
      feature: "beta",
      feature_name: "vad",
      model_provider: "OpenAI",
      model_name: "gpt-4o-mini",
      error_message: "boom",
      error_type: "timeout",
      success: "true",
      count: "3",
      duration_seconds: "45",
      enabled: "false",
    });

    expect(sanitized).toEqual({
      session_id: "s-1",
      session_duration_seconds: "120",
      timestamp: "2026-01-01T00:00:00Z",
      app_version: "0.4.0",
      app_platform: "macOS",
      app_os_version: "26.1",
      app_arch: "aarch64",
      feature: "beta",
      feature_name: "vad",
      model_provider: "OpenAI",
      model_name: "gpt-4o-mini",
      error_message: "boom",
      error_type: "timeout",
      success: "true",
      count: "3",
      duration_seconds: "45",
      enabled: "false",
    });
  });

  test("drops undefined and null values", () => {
    expect(
      sanitizeAnalyticsProperties({
        meeting_id: "m-1",
        success: undefined,
        enabled: null,
      })
    ).toEqual({ meeting_id: "m-1" });
  });

  test("returns empty object for undefined input", () => {
    expect(sanitizeAnalyticsProperties(undefined)).toEqual({});
  });
});

describe("isAllowedAnalyticsPropertyKey", () => {
  test("accepts allowlisted keys and rejects content keys", () => {
    expect(isAllowedAnalyticsPropertyKey("meeting_id")).toBe(true);
    expect(isAllowedAnalyticsPropertyKey("transcript")).toBe(false);
    expect(isAllowedAnalyticsPropertyKey("title")).toBe(false);
    expect(isAllowedAnalyticsPropertyKey("summary")).toBe(false);
  });

  test("every allowlist entry passes the predicate", () => {
    for (const key of ALLOWED_ANALYTICS_PROPERTY_KEYS) {
      expect(isAllowedAnalyticsPropertyKey(key)).toBe(true);
    }
  });
});

describe("resolveAnalyticsConsent", () => {
  test("returns true only for boolean true", () => {
    expect(resolveAnalyticsConsent(true)).toBe(true);
    expect(resolveAnalyticsConsent(false)).toBe(false);
    expect(resolveAnalyticsConsent(undefined)).toBe(false);
    expect(resolveAnalyticsConsent(null)).toBe(false);
    expect(resolveAnalyticsConsent("true")).toBe(false);
    expect(resolveAnalyticsConsent(1)).toBe(false);
  });
});
