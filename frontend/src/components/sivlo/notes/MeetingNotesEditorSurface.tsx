'use client';

import { useCallback, useRef, ReactNode } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMeetingNotes } from '@/features/notes';
import { MeetingNotesEditor, MeetingNotesEditorRef } from './MeetingNotesEditor';
import { NotesStatus } from './NotesStatus';

interface MeetingNotesEditorSurfaceProps {
  meetingId: string;
  header?: ReactNode;
}

/**
 * Self-contained meeting notes editor: loads persisted notes, tracks dirty
 * state, and persists on explicit save. Shared by the standalone /notes route
 * and the embedded Notes tab in the Meeting Intelligence workspace so there is
 * exactly one implementation of the notes editing flow.
 */
export function MeetingNotesEditorSurface({ meetingId, header }: MeetingNotesEditorSurfaceProps) {
  const editorRef = useRef<MeetingNotesEditorRef>(null);

  const { blocks, isLoading, loadError, isDirty, saveStatus, saveError, reload, updateBlocks, persist } =
    useMeetingNotes(meetingId);

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

  return (
    <div className="flex h-full flex-col">
      {header}

      <div className="flex shrink-0 items-center justify-end gap-3 border-b border-border px-4 py-2">
        <NotesStatus isDirty={isDirty} saveStatus={saveStatus} />
        <Button size="sm" onClick={() => void handleSave()} disabled={!isDirty || saveStatus === 'saving'}>
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading notes…
          </div>
        ) : loadError ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="max-w-md text-center text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
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
