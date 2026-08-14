'use client';

import React from 'react';
import { Mic, Upload } from 'lucide-react';

interface PrimaryActionsProps {
  onStartRecording: () => void;
  onImport: () => void;
}

export function PrimaryActions({ onStartRecording, onImport }: PrimaryActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={onStartRecording}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-recording px-6 text-sm font-semibold text-recording-foreground shadow-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Mic className="h-4 w-4" />
        Start recording
      </button>
      <button
        type="button"
        onClick={onImport}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-raised px-6 text-sm font-semibold text-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Upload className="h-4 w-4" />
        Import audio
      </button>
    </div>
  );
}
