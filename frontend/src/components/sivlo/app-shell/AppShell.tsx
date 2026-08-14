'use client';

import React from 'react';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import {
  CONTEXT_SIDEBAR_COLLAPSED_WIDTH,
  CONTEXT_SIDEBAR_WIDTH,
  NAV_RAIL_WIDTH,
} from './navigation';

interface AppShellProps {
  navigation: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Owns the application-level desktop layout.
 *
 *   AppShell
 *   ├── NavigationRail          (primary navigation, stable width)
 *   ├── LegacyContextSidebar    (temporary compatibility/context surface)
 *   └── main workspace          (flex-1, overflow-controlled)
 *
 * Children never compute their own offset from rail/sidebar widths. Fixed
 * overlays rendered by pages (recording controls, status overlays) read the
 * centralized `--sivlo-content-offset` CSS variable instead.
 */
export function AppShell({ navigation, sidebar, children }: AppShellProps) {
  const { isCollapsed } = useSidebar();

  const contextOffset = isCollapsed ? CONTEXT_SIDEBAR_COLLAPSED_WIDTH : CONTEXT_SIDEBAR_WIDTH;
  const contentOffset = NAV_RAIL_WIDTH + contextOffset;

  return (
    <div
      className="flex h-screen w-full overflow-hidden bg-background"
      style={{ '--sivlo-content-offset': `${contentOffset}px` } as React.CSSProperties}
    >
      {navigation}
      {sidebar}
      <main className="min-w-0 flex-1 overflow-hidden">
        <div className="h-full pl-8">{children}</div>
      </main>
    </div>
  );
}
