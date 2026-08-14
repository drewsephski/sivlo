'use client';

import React from 'react';
import { NAV_RAIL_WIDTH } from './navigation';

interface AppShellProps {
  navigation: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Owns the application-level desktop layout.
 *
 *   AppShell
 *   ├── NavigationRail          (primary navigation, stable width)
 *   └── main workspace          (flex-1, overflow-controlled)
 *
 * Children never compute their own offset from the rail width. Fixed
 * overlays rendered by pages (recording controls, status overlays) read the
 * centralized `--sivlo-content-offset` CSS variable instead.
 */
export function AppShell({ navigation, children }: AppShellProps) {
  return (
    <div
      className="flex h-screen w-full overflow-hidden bg-background"
      style={{ '--sivlo-content-offset': `${NAV_RAIL_WIDTH}px` } as React.CSSProperties}
    >
      {navigation}
      <main className="min-w-0 flex-1 overflow-hidden">
        <div className="h-full pl-8">{children}</div>
      </main>
    </div>
  );
}
