export const SETTINGS_TAB = {
  general: "general",
  recording: "recording",
  transcription: "Transcriptionmodels",
  summary: "summaryModels",
  beta: "beta",
} as const;

export type SettingsTab = (typeof SETTINGS_TAB)[keyof typeof SETTINGS_TAB];

const VALID_TABS: ReadonlySet<string> = new Set<string>(
  Object.values(SETTINGS_TAB),
);

export function parseSettingsTab(
  tabParam: string | null | undefined,
): SettingsTab {
  if (tabParam == null || tabParam === "") {
    return SETTINGS_TAB.general;
  }

  if (VALID_TABS.has(tabParam)) {
    return tabParam as SettingsTab;
  }

  return SETTINGS_TAB.general;
}
