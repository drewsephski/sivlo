'use client';

import { Clock } from 'lucide-react';
import type { DerivedDecision } from '@/features/meeting-intelligence';
import { EmptyIntelligenceState } from './EmptyIntelligenceState';
import Analytics from '@/lib/analytics';

interface DecisionsViewProps {
  decisions: DerivedDecision[];
  hasSummary: boolean;
  onGenerateSummary: () => void;
}

/**
 * Decisions derived from the summary's Key Decisions section. Read-only;
 * derived from the canonical summary state — regenerate or edit the Summary
 * tab to update these.
 */
export function DecisionsView({ decisions, hasSummary, onGenerateSummary }: DecisionsViewProps) {
  if (!hasSummary) {
    return (
      <EmptyIntelligenceState
        title="Generate a summary to surface decisions."
        description="Decisions are derived from your summary's Key Decisions section."
        primaryLabel="Generate Summary"
        onPrimary={() => {
          Analytics.trackButtonClick('generate_summary', 'meeting_details');
          onGenerateSummary();
        }}
      />
    );
  }

  if (decisions.length === 0) {
    return (
      <EmptyIntelligenceState
        title="No decisions found in this summary."
        description="Add a Key Decisions section to your summary to see them here."
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <p className="mb-4 text-xs text-muted-foreground">
        Derived from your summary. Regenerate or edit the Summary tab to update.
      </p>
      <ul className="space-y-3">
        {decisions.map((decision, index) => (
          <li
            key={index}
            className="rounded-lg border border-border bg-surface-subtle px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm leading-relaxed text-foreground">
                {decision.decision}
              </p>
              {decision.timestamp && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {decision.timestamp}
                </span>
              )}
            </div>
            {decision.rationale && (
              <p className="mt-1 text-xs text-muted-foreground">{decision.rationale}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
