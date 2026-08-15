'use client';

import { CalendarClock } from 'lucide-react';
import type { DerivedAction } from '@/features/meeting-intelligence';
import { EmptyIntelligenceState } from './EmptyIntelligenceState';
import Analytics from '@/lib/analytics';

interface ActionsViewProps {
  actions: DerivedAction[];
  hasSummary: boolean;
  onGenerateSummary: () => void;
}

/**
 * Action items derived from the summary's Action Items section. Read-only;
 * derived from the canonical summary state — regenerate or edit the Summary
 * tab to update these.
 */
export function ActionsView({ actions, hasSummary, onGenerateSummary }: ActionsViewProps) {
  if (!hasSummary) {
    return (
      <EmptyIntelligenceState
        title="Generate a summary to surface action items."
        description="Action items are derived from your summary's Action Items section."
        primaryLabel="Generate Summary"
        onPrimary={() => {
          Analytics.trackButtonClick('generate_summary', 'meeting_details');
          onGenerateSummary();
        }}
      />
    );
  }

  if (actions.length === 0) {
    return (
      <EmptyIntelligenceState
        title="No action items found in this summary."
        description="Add an Action Items section to your summary to see them here."
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <p className="mb-4 text-xs text-muted-foreground">
        Derived from your summary. Regenerate or edit the Summary tab to update.
      </p>
      <ul className="space-y-3">
        {actions.map((action, index) => (
          <li
            key={index}
            className="rounded-lg border border-border bg-surface-subtle px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {action.owner && (
                  <span className="text-xs font-medium text-primary">{action.owner}</span>
                )}
                <p className="mt-0.5 text-sm leading-relaxed text-foreground">{action.task}</p>
              </div>
              {action.due && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {action.due}
                </span>
              )}
            </div>
            {action.reference && (
              <p className="mt-1 truncate text-xs text-muted-foreground">Ref: {action.reference}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
