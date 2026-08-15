import { storageService } from '@/services/storageService';
import { refreshMeetings } from '@/features/meetings';

/**
 * Auto-generated recording title patterns.
 * Frontend-generated: "Meeting DD_MM_YY_HH_MM_SS" (useRecordingStart).
 * Backend-generated fallback: "Meeting YYYY-MM-DD_HH-MM-SS" (audio default).
 */
const DEFAULT_RECORDING_TITLE_PATTERN =
  /^Meeting (?:\d{2}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}|\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})$/;

/** True when a title is an auto-generated recording default (not user-customized). */
export function isDefaultRecordingTitle(title: string): boolean {
  return DEFAULT_RECORDING_TITLE_PATTERN.test(title.trim());
}

interface AiMeetingTitleOptions {
  onRetitled?: () => void;
}

/**
 * Fire-and-forget AI meeting title generation.
 *
 * Non-blocking by design: the saved/default title is kept on any failure. The
 * backend re-checks that the stored title still equals `expectedTitle` before
 * overwriting, so user-renamed or user-entered titles are never clobbered.
 */
export async function requestAiMeetingTitle(
  meetingId: string,
  expectedTitle: string,
  options: AiMeetingTitleOptions = {}
): Promise<void> {
  try {
    const result = await storageService.generateMeetingTitle(meetingId, expectedTitle);
    if (result.retitled && result.title) {
      await refreshMeetings();
      options.onRetitled?.();
    }
  } catch (error) {
    console.warn('AI meeting title generation skipped:', error);
  }
}
