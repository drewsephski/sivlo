'use client';

import { RefObject } from 'react';
import { Copy, Save } from 'lucide-react';
import { Summary, Transcript } from '@/types';
import { Button } from '@/components/ui/button';
import { BlockNoteSummaryView, BlockNoteSummaryViewRef } from '@/components/AISummary/BlockNoteSummaryView';
import { ModelConfig } from '@/components/ModelSettingsModal';
import { SummaryGeneratorButtonGroup } from '@/components/MeetingDetails/SummaryGeneratorButtonGroup';
import { useMeetingSummaryLanguage } from '@/hooks/meeting-details/useMeetingSummaryLanguage';
import { EmptyIntelligenceState } from './EmptyIntelligenceState';
import Analytics from '@/lib/analytics';

type SummaryStatus = 'idle' | 'processing' | 'summarizing' | 'regenerating' | 'completed' | 'error';

interface SummaryViewProps {
  meeting: { id: string; title: string; created_at: string };
  meetingTitle: string;
  summaryRef: RefObject<BlockNoteSummaryViewRef>;
  aiSummary: Summary | null;
  isSaving: boolean;
  isTitleDirty: boolean;
  onSaveAll: () => Promise<void>;
  onCopySummary: () => Promise<void>;
  summaryStatus: SummaryStatus;
  summaryError: string | null;
  transcripts: Transcript[];
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => void;
  onSaveModelConfig: (config?: ModelConfig) => Promise<void>;
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
  isModelConfigLoading?: boolean;
  onOpenModelSettings?: (openFn: () => void) => void;
}

/**
 * Summary pane of the Meeting Intelligence workspace.
 *
 * Hierarchy: summary content is primary; generation/regeneration, Save and
 * Copy are secondary; Template / Language / Model configuration are tertiary
 * in the compact toolbar. Reuses the existing SummaryGeneratorButtonGroup so
 * model-readiness checks, the Model settings dialog, and template/language
 * selection behave exactly as before.
 */
export function SummaryView({
  meeting,
  meetingTitle,
  summaryRef,
  aiSummary,
  isSaving,
  isTitleDirty,
  onSaveAll,
  onCopySummary,
  summaryStatus,
  summaryError,
  transcripts,
  modelConfig,
  setModelConfig,
  onSaveModelConfig,
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
  isModelConfigLoading = false,
  onOpenModelSettings,
}: SummaryViewProps) {
  const { languageSlot } = useMeetingSummaryLanguage(meeting.id);

  const isSummaryLoading =
    summaryStatus === 'processing' || summaryStatus === 'summarizing' || summaryStatus === 'regenerating';

  const isDirty = isTitleDirty || (summaryRef.current?.isDirty || false);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar: generation + tertiary config on the left, Save/Copy on the right */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <SummaryGeneratorButtonGroup
          modelConfig={modelConfig}
          setModelConfig={setModelConfig}
          onSaveModelConfig={onSaveModelConfig}
          onGenerateSummary={onGenerateSummary}
          onStopGeneration={onStopGeneration}
          customPrompt={customPrompt}
          summaryStatus={summaryStatus}
          availableTemplates={availableTemplates}
          selectedTemplate={selectedTemplate}
          onTemplateSelect={onTemplateSelect}
          hasTranscripts={transcripts.length > 0}
          hasSummary={!!aiSummary}
          isModelConfigLoading={isModelConfigLoading}
          onOpenModelSettings={onOpenModelSettings}
          languageSlot={languageSlot}
        />

        <div className="flex-1" />

        {aiSummary && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onSaveAll()}
              disabled={!isDirty || isSaving}
              title={isDirty ? 'Save summary changes' : 'All changes saved'}
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onCopySummary()}
              title="Copy summary"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1">
        {isSummaryLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="inline-block h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
            <p className="text-sm text-muted-foreground">
              {getSummaryStatusMessage(summaryStatus)}
            </p>
          </div>
        ) : !aiSummary ? (
          <EmptyIntelligenceState
            title="No summary yet"
            description="Generate meeting intelligence from this transcript."
            primaryLabel="Generate Summary"
            onPrimary={() => {
              Analytics.trackButtonClick('generate_summary', 'meeting_details');
              void onGenerateSummary(customPrompt);
            }}
          />
        ) : (
          <div className="h-full overflow-y-auto p-6">
            <BlockNoteSummaryView
              ref={summaryRef}
              summaryData={aiSummary}
              onSave={onSaveSummary}
              onSummaryChange={onSummaryChange}
              onDirtyChange={onDirtyChange}
              status={summaryStatus}
              error={summaryError}
              onRegenerateSummary={() => {
                Analytics.trackButtonClick('regenerate_summary', 'meeting_details');
                void onRegenerateSummary();
              }}
              meeting={{
                id: meeting.id,
                title: meetingTitle,
                created_at: meeting.created_at,
              }}
            />
            {summaryStatus !== 'idle' && (
              <div
                className={`mt-4 rounded-lg p-4 ${
                  summaryStatus === 'error'
                    ? 'bg-destructive/10 text-destructive'
                    : summaryStatus === 'completed'
                      ? 'bg-success/10 text-success'
                      : 'bg-primary/10 text-foreground'
                }`}
              >
                <p className="text-sm font-medium">{getSummaryStatusMessage(summaryStatus)}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
