'use client';

import React from 'react';
import Image from 'next/image';
import { brand } from '@/config/brand';
import { PrimaryActions } from './PrimaryActions';
import { RecentMeetings } from './RecentMeetings';
import { AskSivlo } from '@/features/ask-sivlo/AskSivlo';

interface HomeWorkspaceProps {
  onStartRecording: () => void;
  onImport: () => void;
}

export function HomeWorkspace({ onStartRecording, onImport }: HomeWorkspaceProps) {
  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto px-8 py-12">
      <div className="w-full max-w-4xl">
        <div className="text-center">
          <Image
            src="/brand/sivlo-icon.png"
            alt={`${brand.name} logo`}
            width={56}
            height={56}
            className="mx-auto"
          />
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            {brand.name}
          </h1>
          <p className="mt-2.5 text-base text-muted-foreground">{brand.tagline}</p>
        </div>

        <div className="mt-9">
          <PrimaryActions onStartRecording={onStartRecording} onImport={onImport} />
        </div>

        <div className="mt-10">
          <AskSivlo />
        </div>

        <section className="mt-14" aria-label="Recent meetings">
          <h2 className="mb-3 px-1 text-sm font-semibold text-foreground">Recent meetings</h2>
          <RecentMeetings />
        </section>
      </div>
    </div>
  );
}
