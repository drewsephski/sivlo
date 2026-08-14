'use client';

import { useEffect, useRef, useState } from 'react';
import { useRecordingState } from '@/contexts/RecordingStateContext';

/**
 * Elapsed recording time for presentation.
 *
 * The backend poll (RecordingStateContext) is the authoritative source and
 * normally updates `activeDuration` every 500ms. On a hard reload during an
 * active recording the poll never restarts (the recording-started event does
 * not re-fire), so this hook falls back to a local 1s ticker seeded from the
 * last backend value to keep the clock moving.
 */
export function useRecordingTimer(): number {
  const { activeDuration, isPaused, isRecording } = useRecordingState();
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const lastBackendUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    if (activeDuration !== null) {
      lastBackendUpdateRef.current = Date.now();
      setDisplaySeconds(Math.floor(activeDuration));
    }
  }, [activeDuration]);

  useEffect(() => {
    if (!isRecording || isPaused) return;

    const interval = setInterval(() => {
      // While the backend is polling it owns the source of truth; only tick
      // locally when polling has gone quiet (reload without re-poll).
      if (Date.now() - lastBackendUpdateRef.current < 2000) return;
      setDisplaySeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  return displaySeconds;
}
