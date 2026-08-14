/**
 * Command palette command registry.
 *
 * Pure metadata only — handlers are resolved in CommandPalette.tsx where the
 * navigation/context hooks live. Keeping this module dependency-free makes the
 * registry testable with bun test.
 */

import type { LucideIcon } from 'lucide-react';
import { Home, Library, Mic, Search, Settings, Upload } from 'lucide-react';

export type PaletteCommandId =
  | 'start-recording'
  | 'import-audio'
  | 'home'
  | 'meetings'
  | 'search'
  | 'settings';

export interface PaletteCommand {
  id: PaletteCommandId;
  label: string;
  group: 'Actions' | 'Navigation';
  keywords: string[];
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
  {
    id: 'start-recording',
    label: 'Start recording',
    group: 'Actions',
    keywords: ['record', 'mic', 'start'],
  },
  { id: 'import-audio', label: 'Import audio', group: 'Actions', keywords: ['import', 'upload', 'file'] },
  { id: 'home', label: 'Open Home', group: 'Navigation', keywords: ['home'] },
  { id: 'meetings', label: 'Open Meetings', group: 'Navigation', keywords: ['meetings', 'history'] },
  { id: 'search', label: 'Open Search', group: 'Navigation', keywords: ['search'] },
  { id: 'settings', label: 'Open Settings', group: 'Navigation', keywords: ['settings', 'preferences'] },
];

export const PALETTE_COMMAND_ICONS: Record<PaletteCommandId, LucideIcon> = {
  'start-recording': Mic,
  'import-audio': Upload,
  home: Home,
  meetings: Library,
  search: Search,
  settings: Settings,
};
