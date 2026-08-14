'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Info, Library, Mic, Search, Settings, Square, Upload } from 'lucide-react';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useImportDialog } from '@/contexts/ImportDialogContext';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { BrandMark } from '@/components/sivlo/BrandMark';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { About } from '@/components/About';
import { brand } from '@/config/brand';
import { cn } from '@/lib/utils';
import { getActiveNavigationItem, NAV_RAIL_WIDTH } from './navigation';

interface RailButtonProps {
  label: string;
  tooltip: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

function RailButton({ label, tooltip, icon: Icon, onClick, active = false, disabled = false }: RailButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
            active
              ? 'bg-sidebar-active text-white hover:bg-sidebar-active'
              : 'text-sidebar-foreground hover:bg-sidebar-hover'
          )}
        >
          <Icon className="h-5 w-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function NavigationRail() {
  const router = useRouter();
  const pathname = usePathname();
  const { handleRecordingToggle } = useSidebar();
  const { isRecording } = useRecordingState();
  const { openImportDialog } = useImportDialog();

  const active = getActiveNavigationItem(pathname ?? '');

  const handleMeetings = () => {
    router.push('/meetings');
  };

  const handleSearch = () => {
    router.push('/search');
  };

  const handleImport = () => {
    openImportDialog();
  };

  return (
    <nav
      aria-label="Primary"
      style={{ width: NAV_RAIL_WIDTH }}
      className="no-drag flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <TooltipProvider delayDuration={300}>
        <div className="flex h-full flex-col items-center py-3">
          <div className="mb-3 flex h-10 items-center justify-center">
            <BrandMark isCollapsed />
          </div>

          <div className="flex w-full flex-col items-center gap-1">
            <RailButton
              label="Record"
              tooltip={isRecording ? 'Recording in progress...' : 'Start recording'}
              icon={isRecording ? Square : Mic}
              onClick={handleRecordingToggle}
              disabled={isRecording}
            />
            <RailButton
              label="Home"
              tooltip="Home"
              icon={Home}
              onClick={() => router.push('/')}
              active={active === 'home'}
            />
            <RailButton
              label="Meetings"
              tooltip="Meetings"
              icon={Library}
              onClick={handleMeetings}
              active={active === 'meetings'}
            />
            <RailButton
              label="Search"
              tooltip="Search"
              icon={Search}
              onClick={handleSearch}
              active={active === 'search'}
            />
          </div>

          <div className="flex-1" />

          <div className="flex w-full flex-col items-center gap-1">
            <RailButton
              label="Import audio"
              tooltip="Import audio"
              icon={Upload}
              onClick={handleImport}
            />
            <RailButton
              label="Settings"
              tooltip="Settings"
              icon={Settings}
              onClick={() => router.push('/settings')}
              active={active === 'settings'}
            />
            <Tooltip>
              <Dialog>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      aria-label="About"
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                    >
                      <Info className="h-5 w-5" />
                    </button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">About</TooltipContent>
                <DialogContent>
                  <VisuallyHidden>
                    <DialogTitle>About {brand.name}</DialogTitle>
                  </VisuallyHidden>
                  <About />
                </DialogContent>
              </Dialog>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    </nav>
  );
}
