import { RecordingStatus } from '@/contexts/RecordingStateContext';

export type RecordingWorkspaceState =
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'processing'
  | 'saving'
  | 'error';

/**
 * Pure mapping from the global recording lifecycle to the workspace's visual state.
 *
 * - `isRecording` is backend-authoritative that a session is live, so it always
 *   surfaces the recording surface while audio is being captured.
 * - During the post-stop flow the backend flag flips to false and the lifecycle
 *   status (stopping/processing/saving) drives the presentation.
 */
export function recordingWorkspaceState(
  status: RecordingStatus,
  isRecording: boolean
): RecordingWorkspaceState {
  if (isRecording) return 'recording';

  switch (status) {
    case RecordingStatus.STARTING:
      return 'starting';
    case RecordingStatus.STOPPING:
      return 'stopping';
    case RecordingStatus.PROCESSING_TRANSCRIPTS:
      return 'processing';
    case RecordingStatus.SAVING:
      return 'saving';
    case RecordingStatus.ERROR:
      return 'error';
    default:
      // RECORDING (and defensive IDLE/COMPLETED) while no backend session is
      // live still renders the recording surface.
      return 'recording';
  }
}

/**
 * Format elapsed seconds as MM:SS, or H:MM:SS at/over an hour.
 */
export function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Accessible, human-readable label for the current workspace state.
 */
export function recordingStatusLabel(
  state: RecordingWorkspaceState,
  isPaused = false
): string {
  if (state === 'recording') return isPaused ? 'Paused' : 'Recording';
  switch (state) {
    case 'starting':
      return 'Starting recording';
    case 'stopping':
      return 'Stopping recording';
    case 'processing':
      return 'Finalizing transcription';
    case 'saving':
      return 'Saving meeting';
    case 'error':
      return 'Recording error';
  }
}
