import React from 'react';
import Image from 'next/image';
import { brand } from '@/config/brand';

interface BrandMarkProps {
  isCollapsed?: boolean;
  className?: string;
}

export function BrandMark({ isCollapsed = false, className = '' }: BrandMarkProps) {
  if (isCollapsed) {
    return (
      <Image
        src="/brand/sivlo-icon.png"
        alt={brand.name}
        width={32}
        height={32}
        className={`h-8 w-8 select-none ${className}`}
      />
    );
  }

  return (
    <Image
      src="/brand/sivlo-logo.png"
      alt={brand.name}
      width={120}
      height={120}
      className={`select-none ${className}`}
    />
  );
}
