'use client';

import React from 'react';
import { brand } from '@/config/brand';
import { PrimaryActions } from './PrimaryActions';
import { RecentMeetings } from './RecentMeetings';

interface HomeWorkspaceProps {
  onStartRecording: () => void;
  onImport: () => void;
}

export function HomeWorkspace({ onStartRecording, onImport }: HomeWorkspaceProps) {
  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-8 py-12">
      <div className="w-full max-w-4xl">
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            {brand.name}
          </h1>
          <p className="mt-2.5 text-base text-muted-foreground">{brand.tagline}</p>
        </div>

        <div className="mt-9">
          <PrimaryActions onStartRecording={onStartRecording} onImport={onImport} />
        </div>

        <section className="mt-14" aria-label="Recent meetings">
          <h2 className="mb-3 px-1 text-sm font-semibold text-foreground">Recent meetings</h2>
          <RecentMeetings />
        </section>
      </div>
    </div>
  );
}
