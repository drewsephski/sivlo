/**
 * Meeting notes data actions.
 *
 * Thin orchestration over the storage service, following the
 * features/meetings pattern. Notes are fully independent of meeting
 * summaries.
 */

import type { Block } from '@blocknote/core';
import { storageService } from '@/services/storageService';
import type { BlockNoteBlock } from '@/types';
import type { MeetingNotes } from './types';

export async function fetchMeetingNotes(meetingId: string): Promise<MeetingNotes | null> {
  return storageService.getMeetingNotes(meetingId);
}

export async function saveMeetingNotes(
  meetingId: string,
  notesMarkdown: string,
  notesJson: BlockNoteBlock[],
): Promise<MeetingNotes> {
  return storageService.saveMeetingNotes(meetingId, notesMarkdown, notesJson);
}

/**
 * A BlockNote editor document can never be an empty array: BlockNote throws
 * `initialContent must be a non-empty array of blocks` when given `[]`, so the
 * "empty" editor document is a single empty paragraph block.
 */
function emptyEditorBlock(): Block {
  const block = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'empty-paragraph',
    type: 'paragraph' as const,
    props: {},
    content: [],
  };
  return block as unknown as Block;
}

/**
 * Convert the persisted notes JSON into editor blocks.
 *
 * `notes_json` is the full-fidelity BlockNote document. When notes have never
 * been saved the backend returns null and the editor starts empty; an invalid
 * payload degrades to an empty document instead of crashing. Both cases yield
 * a single empty paragraph so the resulting document is always valid for
 * BlockNote's editor.
 */
export function notesToBlocks(notesJson: MeetingNotes['notes_json'] | null | undefined): Block[] {
  if (!Array.isArray(notesJson) || notesJson.length === 0) {
    return [emptyEditorBlock()];
  }
  return notesJson as unknown as Block[];
}
