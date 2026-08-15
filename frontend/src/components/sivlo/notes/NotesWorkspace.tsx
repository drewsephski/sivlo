'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { storageService } from '@/services/storageService';
import { useMeetingNotes } from '@/features/notes';
import { MeetingNotesEditor, MeetingNotesEditorRef } from './MeetingNotesEditor';
import { NotesStatus } from './NotesStatus';

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
  const editorRef = useRef<MeetingNotesEditorRef>(null);
  const [meetingTitle, setMeetingTitle] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const { blocks, isLoading, loadError, isDirty, saveStatus, saveError, reload, updateBlocks, persist } =
    useMeetingNotes(meetingId);

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

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    let markdown = '';
    try {
      markdown = (await editorRef.current?.getMarkdown(blocks)) ?? '';
    } catch (error) {
      console.warn('Markdown conversion failed, saving JSON only:', error);
      markdown = '';
    }
    try {
      await persist(blocks, markdown);
    } catch {
      // saveStatus is set to 'error' by the hook
    }
  }, [isDirty, blocks, persist]);

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
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <Button variant="ghost" size="sm" onClick={backToMeeting} title="Back to meeting">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden md:inline">Back to meeting</span>
        </Button>

        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-foreground">
              {meetingTitle ? `${meetingTitle} — Notes` : 'Meeting Notes'}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Notes are saved locally and stay with this meeting.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <NotesStatus isDirty={isDirty} saveStatus={saveStatus} />
            <Button size="sm" onClick={handleSave} disabled={!isDirty || saveStatus === 'saving'}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading notes…
          </div>
        ) : loadError ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="max-w-md text-center text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" onClick={reload}>
              Retry
            </Button>
          </div>
        ) : (
          <MeetingNotesEditor ref={editorRef} initialBlocks={blocks} onChange={updateBlocks} />
        )}

        {saveError && <p className="mt-4 text-sm text-destructive">{saveError}</p>}
      </div>
    </div>
  );
}
