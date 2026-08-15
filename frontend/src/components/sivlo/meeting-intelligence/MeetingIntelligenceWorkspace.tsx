'use client';

import { useMemo, RefObject } from 'react';
import { Summary, Transcript } from '@/types';
import { BlockNoteSummaryViewRef } from '@/components/AISummary/BlockNoteSummaryView';
import { ModelConfig } from '@/components/ModelSettingsModal';
import { TranscriptPanel } from '@/components/MeetingDetails/TranscriptPanel';
import { parseActions, parseDecisions, summaryToMarkdown } from '@/features/meeting-intelligence';
import { MeetingHeader } from './MeetingHeader';
import { IntelligenceTabs } from './IntelligenceTabs';
import { SummaryView } from './SummaryView';
import { ActionsView } from './ActionsView';
import { DecisionsView } from './DecisionsView';
import { NotesView } from './NotesView';

export type SummaryStatus = 'idle' | 'processing' | 'summarizing' | 'regenerating' | 'completed' | 'error';

interface MeetingIntelligenceWorkspaceProps {
  meeting: { id: string; title: string; created_at: string; folder_path?: string | null };
  meetingTitle: string;
  isSaving: boolean;
  isTitleDirty: boolean;
  aiSummary: Summary | null;
  summaryRef: RefObject<BlockNoteSummaryViewRef>;
  transcripts: Transcript[];
  onRenameMeeting: (title: string) => Promise<void>;
  onCopyTranscript: () => void | Promise<void>;
  onOpenFolder: () => Promise<void>;
  onCopySummary: () => Promise<void>;
  onSaveAll: () => Promise<void>;
  onPromptChange: (value: string) => void;

  summaryStatus: SummaryStatus;
  summaryError: string | null;
  onGenerateSummary: (customPrompt: string) => Promise<void>;
  onStopGeneration: () => void;
  customPrompt: string;
  onSaveSummary: (summary: Summary | { markdown?: string; summary_json?: any[] }) => Promise<void>;
  onSummaryChange: (summary: Summary) => void;
  onDirtyChange: (isDirty: boolean) => void;
  onRegenerateSummary: () => Promise<void>;
  getSummaryStatusMessage: (status: SummaryStatus) => string;

  availableTemplates: Array<{ id: string; name: string; description: string }>;
  selectedTemplate: string;
  onTemplateSelect: (templateId: string, templateName: string) => void;

  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => void;
  onSaveModelConfig: (config?: ModelConfig) => Promise<void>;
  onOpenModelSettings?: (openFn: () => void) => void;

  // Transcript pagination / retranscription passthrough
  segments?: any[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  totalCount?: number;
  loadedCount?: number;
  onLoadMore?: () => void;
  onRefetchTranscripts?: () => Promise<void>;
}

/**
 * Sivlo Meeting Intelligence workspace: a two-pane layout with the transcript
 * on the left and a Summary / Actions / Decisions / Notes tab system on the
 * right. Actions and Decisions are read-only projections parsed from the
 * canonical summary state (which also reflects in-editor edits), so they stay
 * in sync with what the Summary tab shows.
 */
export function MeetingIntelligenceWorkspace({
  meeting,
  meetingTitle,
  isSaving,
  isTitleDirty,
  aiSummary,
  summaryRef,
  transcripts,
  onRenameMeeting,
  onCopyTranscript,
  onOpenFolder,
  onCopySummary,
  onSaveAll,
  onPromptChange,
  summaryStatus,
  summaryError,
  onGenerateSummary,
  onStopGeneration,
  customPrompt,
  onSaveSummary,
  onSummaryChange,
  onDirtyChange,
  onRegenerateSummary,
  getSummaryStatusMessage,
  availableTemplates,
  selectedTemplate,
  onTemplateSelect,
  modelConfig,
  setModelConfig,
  onSaveModelConfig,
  onOpenModelSettings,
  segments,
  hasMore,
  isLoadingMore,
  totalCount,
  loadedCount,
  onLoadMore,
  onRefetchTranscripts,
}: MeetingIntelligenceWorkspaceProps) {
  const summaryMarkdown = useMemo(() => summaryToMarkdown(aiSummary), [aiSummary]);
  const actions = useMemo(() => parseActions(summaryMarkdown).items, [summaryMarkdown]);
  const decisions = useMemo(() => parseDecisions(summaryMarkdown).items, [summaryMarkdown]);

  const hasSummary = !!aiSummary;

  const generateSummary = () => void onGenerateSummary(customPrompt);

  return (
    <div className="flex h-screen flex-col bg-background">
      <MeetingHeader
        meetingId={meeting.id}
        title={meetingTitle}
        createdAt={meeting.created_at}
        onRename={onRenameMeeting}
        onCopyTranscript={() => void onCopyTranscript()}
        onOpenFolder={() => void onOpenFolder()}
      />

      <div className="flex min-h-0 flex-1">
        <TranscriptPanel
          transcripts={transcripts}
          customPrompt={customPrompt}
          onPromptChange={onPromptChange}
          onCopyTranscript={() => void onCopyTranscript()}
          onOpenMeetingFolder={onOpenFolder}
          isRecording={false}
          disableAutoScroll={true}
          usePagination={true}
          segments={segments}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          totalCount={totalCount}
          loadedCount={loadedCount}
          onLoadMore={onLoadMore}
          meetingId={meeting.id}
          meetingFolderPath={meeting.folder_path}
          onRefetchTranscripts={onRefetchTranscripts}
          className="md:w-2/5 lg:w-[38%]"
        />

        <div className="min-w-0 flex-1 border-l border-border bg-background">
          <IntelligenceTabs>
            {(tab) => (
              <>
                {tab === 'summary' && (
                  <SummaryView
                    meeting={meeting}
                    meetingTitle={meetingTitle}
                    summaryRef={summaryRef}
                    aiSummary={aiSummary}
                    isSaving={isSaving}
                    isTitleDirty={isTitleDirty}
                    onSaveAll={onSaveAll}
                    onCopySummary={onCopySummary}
                    summaryStatus={summaryStatus}
                    summaryError={summaryError}
                    transcripts={transcripts}
                    modelConfig={modelConfig}
                    setModelConfig={setModelConfig}
                    onSaveModelConfig={onSaveModelConfig}
                    onGenerateSummary={onGenerateSummary}
                    onStopGeneration={onStopGeneration}
                    customPrompt={customPrompt}
                    onSaveSummary={onSaveSummary}
                    onSummaryChange={onSummaryChange}
                    onDirtyChange={onDirtyChange}
                    onRegenerateSummary={onRegenerateSummary}
                    getSummaryStatusMessage={getSummaryStatusMessage}
                    availableTemplates={availableTemplates}
                    selectedTemplate={selectedTemplate}
                    onTemplateSelect={onTemplateSelect}
                    onOpenModelSettings={onOpenModelSettings}
                  />
                )}
                {tab === 'actions' && (
                  <ActionsView actions={actions} hasSummary={hasSummary} onGenerateSummary={generateSummary} />
                )}
                {tab === 'decisions' && (
                  <DecisionsView
                    decisions={decisions}
                    hasSummary={hasSummary}
                    onGenerateSummary={generateSummary}
                  />
                )}
                {tab === 'notes' && <NotesView meetingId={meeting.id} />}
              </>
            )}
          </IntelligenceTabs>
        </div>
      </div>
    </div>
  );
}
