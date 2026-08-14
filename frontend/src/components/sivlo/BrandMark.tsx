import React from 'react';
import { brand } from '@/config/brand';

interface BrandMarkProps {
  isCollapsed?: boolean;
  className?: string;
}

export function BrandMark({ isCollapsed = false, className = '' }: BrandMarkProps) {
  if (isCollapsed) {
    return (
      <span
        aria-label={brand.name}
        className={`flex h-8 w-10 items-center justify-center rounded-full bg-blue-50 text-lg font-semibold text-gray-700 select-none ${className}`}
      >
        S
      </span>
    );
  }

  return (
    <span
      aria-label={brand.name}
      className={`text-lg font-semibold text-gray-700 select-none ${className}`}
    >
      {brand.wordmark}
    </span>
  );
}
