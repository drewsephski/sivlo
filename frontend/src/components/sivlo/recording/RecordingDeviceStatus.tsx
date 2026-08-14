'use client';

import React from 'react';

interface RecordingDeviceStatusProps {
  micDevice: string | null;
  systemDevice: string | null;
}

/**
 * Compact summary of the audio devices in use for the current session.
 */
export function RecordingDeviceStatus({
  micDevice,
  systemDevice,
}: RecordingDeviceStatusProps) {
  const devices = [
    micDevice && { label: 'Mic', value: micDevice },
    systemDevice && { label: 'System', value: systemDevice },
  ].filter(Boolean) as { label: string; value: string }[];

  if (devices.length === 0) return null;

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {devices.map(({ label, value }) => (
        <span key={label} className="truncate">
          <span className="font-medium text-foreground/70">{label}</span> {value}
        </span>
      ))}
    </div>
  );
}
