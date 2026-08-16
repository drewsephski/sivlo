export const ALLOWED_ANALYTICS_PROPERTY_KEYS = [
  'meeting_id',
  'session_id',
  'session_duration',
  'session_duration_seconds',
  'timestamp',
  'app_version',
  'is_first_launch',
  'is_daily_active',
  'app_platform',
  'app_os_version',
  'app_arch',
  'feature',
  'feature_name',
  'beta_feature_name',
  'setting_type',
  'new_value',
  'model_provider',
  'model_name',
  'error_message',
  'error_type',
  'success',
  'count',
  'duration_seconds',
  'viewed_at',
  'old_provider',
  'old_model',
  'new_provider',
  'new_model',
  'transcription_provider',
  'transcription_model',
  'summary_provider',
  'summary_model',
  'transcript_length',
  'prompt_length',
  'total_duration_seconds',
  'active_duration_seconds',
  'pause_duration_seconds',
  'microphone_device_type',
  'system_audio_device_type',
  'chunks_processed',
  'transcript_segments_count',
  'transcript_segments',
  'transcript_word_count',
  'words_per_minute',
  'had_fatal_error',
  'days_since_last_meeting',
  'total_meetings',
  'meetings_in_session',
  'meetings_today',
  'day_of_week',
  'hour_of_day',
  'is_first_use',
  'copy_type',
  'copy_count_today',
  'duration',
  'segments_count',
  'file_size_bytes',
  'language',
  'time_since_recording_minutes',
  'date',
  'enabled',
] as const;

export type AnalyticsPropertyKey = (typeof ALLOWED_ANALYTICS_PROPERTY_KEYS)[number];

export function isAllowedAnalyticsPropertyKey(key: string): key is AnalyticsPropertyKey {
  return (ALLOWED_ANALYTICS_PROPERTY_KEYS as readonly string[]).includes(key);
}

export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown> | undefined
): Record<string, string> {
  if (!properties) return {};

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (isAllowedAnalyticsPropertyKey(key) && value !== undefined && value !== null) {
      sanitized[key] = String(value);
    }
  }
  return sanitized;
}

export function resolveAnalyticsConsent(value: unknown): boolean {
  return value === true;
}
