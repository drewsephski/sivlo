'use client';

import { useCallback, useRef } from 'react';
import { appDataDir } from '@tauri-apps/api/path';
import { useRecordingState, RecordingStatus } from '@/contexts/RecordingStateContext';
import { recordingService } from '@/services/recordingService';
import Analytics from '@/lib/analytics';

interface UseRecordingStopActionOptions {
  /** Called immediately when the user initiates a stop (drives UI to STOPPING). */
  onStopInitiated?: () => void;
  /** Called with `true` after the backend stop succeeds, `false` on failure. */
  onRecordingStopped: (callApi?: boolean) => void;
}

/**
 * Stop-button action for the recording workspace.
 *
 * Mirrors the behavior previously embedded in RecordingControls:
 * - Guards against duplicate/in-flight stops and stops while starting.
 * - Resolves an appDataDir-based save path (the backend ignores it today).
 * - Silently ignores "No recording in progress" (tray/keyboard may have
 *   already stopped the session).
 */
export function useRecordingStopAction({
  onStopInitiated,
  onRecordingStopped,
}: UseRecordingStopActionOptions) {
  const { isRecording, status } = useRecordingState();
  const inFlightRef = useRef(false);

  const handleStopRecording = useCallback(async () => {
    if (inFlightRef.current) return;
    if (!isRecording || status === RecordingStatus.STARTING) return;

    inFlightRef.current = true;
    onStopInitiated?.();

    try {
      const dataDir = await appDataDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const savePath = `${dataDir}/recording-${timestamp}.wav`;

      await recordingService.stopRecording(savePath);
      Analytics.trackTranscriptionSuccess();
      onRecordingStopped(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('No recording in progress')) {
        console.error('Failed to stop recording:', error);
        onRecordingStopped(false);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [isRecording, status, onStopInitiated, onRecordingStopped]);

  return { handleStopRecording };
}
