'use client';

import { ReactNode, useState } from 'react';

export type IntelligenceTabId = 'summary' | 'actions' | 'decisions' | 'notes';

interface IntelligenceTabsProps {
  children: (tabId: IntelligenceTabId) => ReactNode;
  initialTab?: IntelligenceTabId;
}

const TABS: Array<{ id: IntelligenceTabId; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'actions', label: 'Actions' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'notes', label: 'Notes' },
];

/**
 * Segmented control for the Meeting Intelligence panes.
 *
 * Unlike Radix Tabs, every panel stays mounted and is hidden with CSS, so
 * unsaved edits in the Summary editor and Notes editor survive tab switches.
 */
export function IntelligenceTabs({ children, initialTab = 'summary' }: IntelligenceTabsProps) {
  const [activeTab, setActiveTab] = useState<IntelligenceTabId>(initialTab);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div
        role="tablist"
        aria-label="Meeting intelligence"
        className="flex shrink-0 items-center gap-1 border-b border-border px-4"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {TABS.map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            hidden={activeTab !== tab.id}
            className="h-full"
          >
            {children(tab.id)}
          </div>
        ))}
      </div>
    </div>
  );
}
