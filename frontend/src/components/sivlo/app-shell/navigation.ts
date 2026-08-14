export const NAV_RAIL_WIDTH = 64;

export type NavigationItemId = 'home' | 'meetings' | 'search' | 'import' | 'settings';

export function getActiveNavigationItem(pathname: string): NavigationItemId | null {
  if (!pathname) return null;
  const path = pathname.split('?')[0];
  if (path === '/') return 'home';
  if (path === '/meetings') return 'meetings';
  if (path === '/search') return 'search';
  if (path === '/settings') return 'settings';
  if (path.startsWith('/meeting-details')) return 'meetings';
  if (path.startsWith('/notes/')) return 'meetings';
  return null;
}
