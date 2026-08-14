import { RecordingStatus } from '@/contexts/RecordingStateContext';

export type HomeViewMode = 'workspace' | 'recording';

const ACTIVE_RECORDING_STATUSES: RecordingStatus[] = [
  RecordingStatus.STARTING,
  RecordingStatus.RECORDING,
  RecordingStatus.STOPPING,
  RecordingStatus.PROCESSING_TRANSCRIPTS,
  RecordingStatus.SAVING,
];

/**
 * Pure mapping from recording lifecycle to Home's high-level view mode.
 *
 * - workspace: idle (not recording, not processing) → new Sivlo Home experience
 * - recording: any active recording/processing/saving state → transcript-first view
 */
export function homeViewMode(status: RecordingStatus, isRecording: boolean): HomeViewMode {
  if (isRecording) return 'recording';
  return ACTIVE_RECORDING_STATUSES.includes(status) ? 'recording' : 'workspace';
}
