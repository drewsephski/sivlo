'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { recordingService } from '@/services/recordingService';
import Analytics from '@/lib/analytics';

/**
 * Pause/resume controls for the recording workspace.
 *
 * isPaused is owned by RecordingStateContext (synced via backend events and
 * polling), so this hook only guards and invokes the backend command, then
 * surfaces failures as toasts. Mirrors the behavior previously embedded in
 * RecordingControls.
 */
export function useRecordingPauseResume() {
  const { isRecording, isPaused } = useRecordingState();
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  const togglePauseResume = useCallback(async () => {
    if (!isRecording) return;

    if (isPaused) {
      if (isResuming) return;
      setIsResuming(true);
      try {
        await recordingService.resumeRecording();
        Analytics.trackButtonClick('resume_recording', 'recording_workspace');
      } catch (error) {
        console.error('Failed to resume recording:', error);
        toast.error('Failed to resume recording', {
          description: error instanceof Error ? error.message : 'Please try again.',
        });
      } finally {
        setIsResuming(false);
      }
    } else {
      if (isPausing) return;
      setIsPausing(true);
      try {
        await recordingService.pauseRecording();
        Analytics.trackButtonClick('pause_recording', 'recording_workspace');
      } catch (error) {
        console.error('Failed to pause recording:', error);
        toast.error('Failed to pause recording', {
          description: error instanceof Error ? error.message : 'Please try again.',
        });
      } finally {
        setIsPausing(false);
      }
    }
  }, [isRecording, isPaused, isPausing, isResuming]);

  return { isPaused, isPausing, isResuming, togglePauseResume };
}
