'use client';

/**
 * useMeetingNotes
 *
 * Loads persisted notes for a meeting, tracks editing state, and persists on
 * explicit save (no autosave). `notes_json` is the source of truth for editor
 * content; `notes_markdown` is saved alongside it for portability.
 *
 * Save UX mirrors the shared Summary editor conventions: an explicit Save
 * action with Saved / Unsaved changes / Saving / Save failed statuses. The
 * dirty flag is only set after initial content has finished loading so
 * programmatic editor initialization never marks the document as dirty.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Block } from '@blocknote/core';
import type { BlockNoteBlock } from '@/types';
import { fetchMeetingNotes, notesToBlocks, saveMeetingNotes } from './meeting-notes';
import type { MeetingNotes, NotesSaveStatus } from './types';

export function useMeetingNotes(meetingId: string) {
  const [notes, setNotes] = useState<MeetingNotes | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<NotesSaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const contentLoadedRef = useRef(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    contentLoadedRef.current = false;
    try {
      const result = await fetchMeetingNotes(meetingId);
      setNotes(result);
      const initial = notesToBlocks(result?.notes_json);
      setBlocks(initial);
      setIsDirty(false);
      setSaveStatus('idle');
      setSaveError(null);
    } catch (error) {
      console.error('Failed to load meeting notes:', error);
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      contentLoadedRef.current = true;
      setIsLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateBlocks = useCallback((next: Block[]) => {
    if (!contentLoadedRef.current) return;
    setBlocks(next);
    setIsDirty(true);
  }, []);

  const persist = useCallback(
    async (latestBlocks: Block[], markdown: string) => {
      setSaveStatus('saving');
      setSaveError(null);
      try {
        const saved = await saveMeetingNotes(
          meetingId,
          markdown,
          latestBlocks as unknown as BlockNoteBlock[],
        );
        setNotes(saved);
        setBlocks(latestBlocks);
        setIsDirty(false);
        setSaveStatus('saved');
        return saved;
      } catch (error) {
        console.error('Failed to save meeting notes:', error);
        setSaveError(error instanceof Error ? error.message : String(error));
        setSaveStatus('error');
        throw error;
      }
    },
    [meetingId],
  );

  return {
    notes,
    blocks,
    isLoading,
    loadError,
    isDirty,
    saveStatus,
    saveError,
    reload,
    updateBlocks,
    persist,
  };
}
