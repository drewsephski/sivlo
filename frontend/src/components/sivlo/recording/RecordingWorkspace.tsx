'use client';

import React, { useCallback } from 'react';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useConfig } from '@/contexts/ConfigContext';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import type { ModalType } from '@/hooks/useModalState';
import { useRecordingPauseResume } from '@/hooks/useRecordingPauseResume';
import { useRecordingStopAction } from '@/hooks/useRecordingStopAction';
import { useRecordingTimer } from '@/hooks/useRecordingTimer';
import { TranscriptPanel } from '@/app/_components/TranscriptPanel';
import Analytics from '@/lib/analytics';
import { RecordingHeader } from './RecordingHeader';
import { RecordingTransport } from './RecordingTransport';
import { ProcessingWorkspace } from './ProcessingWorkspace';
import { recordingWorkspaceState } from './recording-view-state';

interface RecordingWorkspaceProps {
  showModal: (name: ModalType, message?: string) => void;
  onRecordingStopped: (callApi?: boolean) => void;
  onStopInitiated?: () => void;
}

/**
 * Transcript-first live recording experience.
 *
 * Replaces the legacy floating RecordingControls + StatusOverlays with a
 * dedicated workspace: header (read-only title + live status), the shared
 * live transcript, and a footer transport / post-stop processing region.
 * Reuses the existing hooks, services, and events — no new backend surface.
 */
export function RecordingWorkspace({
  showModal,
  onRecordingStopped,
  onStopInitiated,
}: RecordingWorkspaceProps) {
  const { meetingTitle } = useTranscripts();
  const { selectedDevices } = useConfig();
  const { status, isRecording, isPaused, isStopping, isProcessing } =
    useRecordingState();

  const state = recordingWorkspaceState(status, isRecording);
  const elapsedSeconds = useRecordingTimer();
  const { isPausing, isResuming, togglePauseResume } = useRecordingPauseResume();
  const { handleStopRecording } = useRecordingStopAction({
    onStopInitiated,
    onRecordingStopped,
  });

  const handleStop = useCallback(() => {
    Analytics.trackButtonClick('stop_recording', 'recording_workspace');
    void handleStopRecording();
  }, [handleStopRecording]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <RecordingHeader
        title={meetingTitle}
        state={state}
        elapsedSeconds={elapsedSeconds}
        isPaused={isPaused}
        micDevice={selectedDevices?.micDevice ?? null}
        systemDevice={selectedDevices?.systemDevice ?? null}
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto h-full w-full max-w-4xl border-x border-border">
          <TranscriptPanel
            isProcessingStop={isProcessing}
            isStopping={isStopping}
            showModal={showModal}
            showStatusBar={false}
          />
        </div>
      </div>

      {state === 'error' ? (
        <div
          role="alert"
          className="border-t border-border bg-destructive/10 px-6 py-4 text-center text-sm font-medium text-destructive"
        >
          Recording encountered an error. Your meeting was not saved.
        </div>
      ) : state === 'starting' || state === 'recording' ? (
        <RecordingTransport
          state={state}
          isPaused={isPaused}
          isPausing={isPausing}
          isResuming={isResuming}
          onTogglePauseResume={() => void togglePauseResume()}
          onStop={handleStop}
        />
      ) : (
        <ProcessingWorkspace state={state} />
      )}
    </div>
  );
}
