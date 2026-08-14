'use client';

import React from 'react';
import { CalendarDays, Mic, Upload } from 'lucide-react';

interface MeetingsEmptyStateProps {
  onStartRecording: () => void;
  onImport: () => void;
}

export function MeetingsEmptyState({ onStartRecording, onImport }: MeetingsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
      <CalendarDays className="h-8 w-8 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold text-foreground">No meetings yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Record your first meeting or import an existing audio file. Everything stays on this
        device.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onStartRecording}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-recording px-5 text-sm font-semibold text-recording-foreground shadow-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Mic className="h-4 w-4" />
          Start recording
        </button>
        <button
          type="button"
          onClick={onImport}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-surface-raised px-5 text-sm font-semibold text-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Upload className="h-4 w-4" />
          Import audio
        </button>
      </div>
    </div>
  );
}
