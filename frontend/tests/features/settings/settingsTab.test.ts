import { describe, expect, test } from "bun:test";
import {
  SETTINGS_TAB,
  parseSettingsTab,
} from "../../../src/features/settings/settingsTab";

describe("parseSettingsTab", () => {
  test("undefined_tab_returns_general", () => {
    expect(parseSettingsTab(undefined)).toBe(SETTINGS_TAB.general);
  });

  test("null_tab_returns_general", () => {
    expect(parseSettingsTab(null)).toBe(SETTINGS_TAB.general);
  });

  test("empty_tab_returns_general", () => {
    expect(parseSettingsTab("")).toBe(SETTINGS_TAB.general);
  });

  test("summary_models_tab_valid", () => {
    expect(parseSettingsTab("summaryModels")).toBe(SETTINGS_TAB.summary);
  });

  test("recording_tab_valid", () => {
    expect(parseSettingsTab("recording")).toBe(SETTINGS_TAB.recording);
  });

  test("transcription_tab_valid", () => {
    expect(parseSettingsTab("Transcriptionmodels")).toBe(
      SETTINGS_TAB.transcription,
    );
  });

  test("beta_tab_valid", () => {
    expect(parseSettingsTab("beta")).toBe(SETTINGS_TAB.beta);
  });

  test("invalid_tab_returns_general", () => {
    expect(parseSettingsTab("invalidTabValue")).toBe(SETTINGS_TAB.general);
  });
});
