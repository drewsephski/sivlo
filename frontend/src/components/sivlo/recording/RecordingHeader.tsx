'use client';

import React from 'react';
import { RecordingStatus } from './RecordingStatus';
import { RecordingDeviceStatus } from './RecordingDeviceStatus';
import { RecordingWorkspaceState } from './recording-view-state';

interface RecordingHeaderProps {
  title: string;
  state: RecordingWorkspaceState;
  elapsedSeconds: number;
  isPaused?: boolean;
  micDevice?: string | null;
  systemDevice?: string | null;
}

/**
 * Top bar for the recording workspace: read-only meeting title, device
 * summary, and the live recording status/timer.
 *
 * The title is intentionally read-only while recording — the saved meeting
 * name is sourced from the backend at stop time, so inline edits would not
 * persist. Rename happens in Meeting Details after the meeting is saved.
 */
export function RecordingHeader({
  title,
  state,
  elapsedSeconds,
  isPaused = false,
  micDevice,
  systemDevice,
}: RecordingHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-border bg-surface px-6 py-3">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold text-foreground">
          {title || 'Untitled meeting'}
        </h1>
        <RecordingDeviceStatus
          micDevice={micDevice ?? null}
          systemDevice={systemDevice ?? null}
        />
      </div>
      <RecordingStatus
        state={state}
        elapsedSeconds={elapsedSeconds}
        isPaused={isPaused}
      />
    </header>
  );
}
