'use client';

import React from 'react';
import {
  formatElapsed,
  recordingStatusLabel,
  RecordingWorkspaceState,
} from './recording-view-state';

interface RecordingStatusProps {
  state: RecordingWorkspaceState;
  elapsedSeconds: number;
  isPaused?: boolean;
}

const BUSY_STATES: RecordingWorkspaceState[] = [
  'starting',
  'stopping',
  'processing',
  'saving',
];

/**
 * Accessible status indicator for the recording workspace.
 *
 * Combines a colored dot/spinner (never color alone) with a text label, and
 * shows the live elapsed timer while actively recording.
 */
export function RecordingStatus({
  state,
  elapsedSeconds,
  isPaused = false,
}: RecordingStatusProps) {
  const showTimer = state === 'recording';
  const isBusy = BUSY_STATES.includes(state);
  const label = recordingStatusLabel(state, isPaused);

  const indicatorClass =
    state === 'error'
      ? 'h-2 w-2 rounded-full bg-destructive'
      : state === 'recording'
        ? isPaused
          ? 'h-2 w-2 rounded-full bg-warning'
          : 'h-2 w-2 rounded-full bg-recording animate-pulse'
        : isBusy
          ? 'h-3 w-3 animate-spin rounded-full border-2 border-border border-t-muted-foreground'
          : 'h-2 w-2 rounded-full bg-border';

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex shrink-0 items-center gap-2 rounded-full bg-surface-subtle px-3 py-1.5"
    >
      <span className={indicatorClass} aria-hidden="true" />
      <span className="text-sm font-medium text-foreground">{label}</span>
      {showTimer && (
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatElapsed(elapsedSeconds)}
        </span>
      )}
    </div>
  );
}
