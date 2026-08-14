'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SearchWorkspace } from '@/components/sivlo/search/SearchWorkspace';

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  return <SearchWorkspace initialQuery={initialQuery} />;
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}
