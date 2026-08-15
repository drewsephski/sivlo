'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface EmptyIntelligenceStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondary?: ReactNode;
}

/**
 * Shared empty state for the Meeting Intelligence panes. Uses semantic tokens
 * only; a primary action (e.g. Generate Summary) with optional secondary
 * affordances below.
 */
export function EmptyIntelligenceState({
  title,
  description,
  icon,
  primaryLabel,
  onPrimary,
  secondary,
}: EmptyIntelligenceStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div className="max-w-sm">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {(primaryLabel && onPrimary) || secondary ? (
        <div className="flex items-center gap-3">
          {primaryLabel && onPrimary && (
            <Button size="sm" onClick={onPrimary}>
              {primaryLabel}
            </Button>
          )}
          {secondary}
        </div>
      ) : null}
    </div>
  );
}
