'use client';

import React from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RecordingWorkspaceState } from './recording-view-state';

interface RecordingTransportProps {
  state: RecordingWorkspaceState;
  isPaused: boolean;
  isPausing?: boolean;
  isResuming?: boolean;
  onTogglePauseResume: () => void;
  onStop: () => void;
}

/**
 * Footer transport for the recording workspace: Pause/Resume and Stop.
 *
 * Stop is the primary action (red recording token). Pause/Resume exposes its
 * state via aria-pressed; labels are never color-only.
 */
export function RecordingTransport({
  state,
  isPaused,
  isPausing = false,
  isResuming = false,
  onTogglePauseResume,
  onStop,
}: RecordingTransportProps) {
  const isTransitioning = state === 'starting' || state === 'stopping';
  const busy = isPausing || isResuming;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center justify-center gap-3 border-t border-border bg-surface px-6 py-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onTogglePauseResume}
              disabled={busy || isTransitioning}
              aria-pressed={isPaused}
              aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised text-foreground ring-1 ring-border transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isPaused ? 'Resume recording' : 'Pause recording'}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onStop}
              disabled={busy || isTransitioning}
              aria-label="Stop recording"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-recording text-recording-foreground shadow-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Square className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Stop recording</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
