'use client';

import React from 'react';
import {
  recordingStatusLabel,
  RecordingWorkspaceState,
} from './recording-view-state';

type PostRecordingState = Exclude<
  RecordingWorkspaceState,
  'starting' | 'recording' | 'error'
>;

interface ProcessingWorkspaceProps {
  state: PostRecordingState;
}

/**
 * Post-stop status region. Keeps the transcript visible above while a thin
 * footer communicates stopping/processing/saving progress.
 */
export function ProcessingWorkspace({ state }: ProcessingWorkspaceProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-t border-border bg-surface px-6 py-4"
    >
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-muted-foreground"
        aria-hidden="true"
      />
      <span className="text-sm text-muted-foreground">
        {recordingStatusLabel(state)}
      </span>
    </div>
  );
}
