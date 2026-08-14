export const NAV_RAIL_WIDTH = 64;

export const CONTEXT_SIDEBAR_WIDTH = 256;

export const CONTEXT_SIDEBAR_COLLAPSED_WIDTH = 64;

export const SEARCH_FOCUS_EVENT = 'sivlo:focus-sidebar-search';

export type NavigationItemId = 'home' | 'meetings' | 'search' | 'import' | 'settings';

export function getActiveNavigationItem(pathname: string): NavigationItemId | null {
  if (!pathname) return null;
  if (pathname === '/') return 'home';
  if (pathname === '/meetings') return 'meetings';
  if (pathname === '/settings') return 'settings';
  if (pathname.startsWith('/meeting-details')) return 'meetings';
  if (pathname.startsWith('/notes/')) return 'meetings';
  return null;
}
