'use client';

import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { APP_VERSION } from '@/config/version';

interface AppVersionProps {
  className?: string;
}

export function AppVersion({ className }: AppVersionProps) {
  const [version, setVersion] = useState(APP_VERSION);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(APP_VERSION));
  }, []);

  return (
    <span className={className} aria-label={`Version ${version}`}>
      v{version}
    </span>
  );
}
