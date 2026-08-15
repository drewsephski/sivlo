'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { storageService } from '@/services/storageService';
import { MeetingNotesEditorSurface } from './MeetingNotesEditorSurface';

interface NotesWorkspaceProps {
  meetingId: string;
}

function NotesErrorState({
  title,
  message,
  onBack,
}: {
  title: string;
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
    </div>
  );
}

export function NotesWorkspace({ meetingId }: NotesWorkspaceProps) {
  const router = useRouter();
  const [meetingTitle, setMeetingTitle] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMeetingTitle(null);
    setMetadataError(null);
    if (!meetingId) return;

    storageService
      .getMeetingMetadata(meetingId)
      .then(meta => {
        if (!cancelled) setMeetingTitle(meta.title);
      })
      .catch(err => {
        console.error('Failed to load meeting metadata:', err);
        if (!cancelled) {
          setMetadataError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  const backToMeeting = useCallback(() => {
    if (meetingId) {
      router.push(`/meeting-details?id=${encodeURIComponent(meetingId)}`);
    } else {
      router.push('/');
    }
  }, [meetingId, router]);

  if (!meetingId) {
    return (
      <NotesErrorState
        title="No meeting selected"
        message="Open Notes from a meeting to view or edit its notes."
        onBack={backToMeeting}
      />
    );
  }

  if (metadataError) {
    return (
      <NotesErrorState title="Meeting not found" message={metadataError} onBack={backToMeeting} />
    );
  }

  return (
    <MeetingNotesEditorSurface
      meetingId={meetingId}
      header={
        <div className="px-8 pt-6">
          <Button variant="ghost" size="sm" onClick={backToMeeting} title="Back to meeting">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden md:inline">Back to meeting</span>
          </Button>

          <div className="mt-3 mb-4 min-w-0">
            <h1 className="truncate text-2xl font-semibold text-foreground">
              {meetingTitle ? `${meetingTitle} — Notes` : 'Meeting Notes'}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Notes are saved locally and stay with this meeting.
            </p>
          </div>
        </div>
      }
    />
  );
}
