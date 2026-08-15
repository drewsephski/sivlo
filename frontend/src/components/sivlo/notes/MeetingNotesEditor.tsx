'use client';

import { forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import type { Block } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { blocksToMarkdownSafely } from '@/lib/blocknote-markdown';

// Dynamically import BlockNote Editor to avoid SSR issues (same pattern as
// the shared Summary editor).
const Editor = dynamic(() => import('@/components/BlockNoteEditor/Editor'), { ssr: false });

export interface MeetingNotesEditorRef {
  /** Convert the given blocks to markdown for persistence. */
  getMarkdown: (blocks: Block[]) => Promise<string>;
}

interface MeetingNotesEditorProps {
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
  editable?: boolean;
}

/**
 * BlockNote editor for meeting notes. Uses the shared Editor for editing and
 * a lightweight converter editor (created via useCreateBlockNote, mirroring
 * BlockNoteSummaryView) to export markdown on save.
 */
export const MeetingNotesEditor = forwardRef<MeetingNotesEditorRef, MeetingNotesEditorProps>(
  function MeetingNotesEditor({ initialBlocks, onChange, editable = true }, ref) {
    const converter = useCreateBlockNote({ initialContent: undefined });

    useImperativeHandle(
      ref,
      () => ({
        getMarkdown: async (blocks) => {
          const result = await blocksToMarkdownSafely(converter, blocks, {
            source: 'MeetingNotesEditor.save',
          });
          return result.markdown ?? '';
        },
      }),
      [converter],
    );

    return (
      <div className="w-full min-h-[50vh]">
        <Editor initialContent={initialBlocks} onChange={onChange} editable={editable} />
      </div>
    );
  },
);
